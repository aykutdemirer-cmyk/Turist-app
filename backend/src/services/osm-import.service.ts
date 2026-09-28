import { boundingBox, type LatLng } from '@localbite/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { env } from '../env';
import { commonsFileFromTags, findOpenPhotos } from '../lib/openPhotos';
import { fromOsm, OSM_FOOD_FILTER, overpass, OVERPASS_URLS, type OsmElement } from './live-places.service';

/**
 * OpenStreetMap yemek mekanlarını kendi veritabanımıza aktarır (ücretsiz, ODbL). Uygulama listeyi anlık
 * (sık sık 504 veren) herkese açık Overpass yerine buradan okur.
 *
 * Dünya ~5 km'lik karelere bölünür; İstanbul kareleri baştan kuyruğa girer, kullanıcının baktığı başka bir
 * bölge de istenince eklenir ve öne alınır. Aktarıcı tek tek, yavaşça ve tekrar deneyerek çalışır; her kare
 * haftada bir yenilenir. Overpass'ı yormamak için aynı anda tek sorgu.
 */

const TILE_DEG = 0.05;
/** İstanbul'un yoğun yerleşim alanı: ilk açılışta kuyruğa girer */
const SEED_AREA = { minLat: 40.8, maxLat: 41.3, minLng: 28.45, maxLng: 29.45 };
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
/** Başarılı kareler arası bekleme; hata sonrası artan bekleme (en çok 15 dk) */
const PAUSE_MS = 10_000;
const MAX_BACKOFF_MS = 15 * 60_000;
const IDLE_MS = 5 * 60_000;
const IMPORT_TIMEOUT_MS = 90_000;

export const tileKeyOf = (latitude: number, longitude: number) =>
  `${Math.floor(latitude / TILE_DEG)}:${Math.floor(longitude / TILE_DEG)}`;

function tileBox(key: string) {
  const [i, j] = key.split(':').map(Number) as [number, number];
  return { minLat: i * TILE_DEG, maxLat: (i + 1) * TILE_DEG, minLng: j * TILE_DEG, maxLng: (j + 1) * TILE_DEG };
}

function tilesIn(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }): string[] {
  const keys: string[] = [];
  for (let i = Math.floor(box.minLat / TILE_DEG); i <= Math.floor(box.maxLat / TILE_DEG); i += 1) {
    for (let j = Math.floor(box.minLng / TILE_DEG); j <= Math.floor(box.maxLng / TILE_DEG); j += 1) keys.push(`${i}:${j}`);
  }
  return keys;
}

/** Kullanıcının baktığı bölgenin henüz aktarılmamış kareleri öne alınır */
export async function requestTilesNear(center: LatLng, radiusM: number) {
  const keys = tilesIn(boundingBox(center, radiusM));
  const existing = await prisma.osmImportTile.findMany({ where: { key: { in: keys } }, select: { key: true, importedAt: true } });
  const known = new Map(existing.map((t) => [t.key, t.importedAt]));
  const missing = keys.filter((k) => !known.has(k));
  const now = new Date();
  if (missing.length) {
    await prisma.osmImportTile.createMany({ data: missing.map((key) => ({ key, requestedAt: now })), skipDuplicates: true });
  }
  const notImported = keys.filter((k) => known.has(k) && known.get(k) === null);
  if (notImported.length) {
    await prisma.osmImportTile.updateMany({ where: { key: { in: notImported } }, data: { requestedAt: now } });
  }
}

/** Son başarılı Overpass sunucusu önce denenir (ana sunucu yoğunken yansı). live-places ile karşılıklı içe
 * aktarma olduğundan liste modül yüklenirken değil, ilk kullanımda okunur. */
let preferredUrl: string | null = null;

/** Kareyi aktarır: kareye ait (merkezi karenin içinde olan) yemek mekanları yenilenir, OSM'den silinenler çıkar */
export async function importTile(key: string): Promise<number> {
  const box = tileBox(key);
  const bbox = [box.minLat, box.minLng, box.maxLat, box.maxLng].map((n) => n.toFixed(5)).join(',');
  const query = `[out:json][timeout:60][bbox:${bbox}];${OSM_FOOD_FILTER}out center tags;`;
  const first = preferredUrl ?? OVERPASS_URLS[0]!;
  const urls = [first, ...OVERPASS_URLS.filter((u) => u !== first)];
  let elements: OsmElement[] | undefined;
  let lastError: unknown;
  for (const url of urls) {
    try {
      elements = await overpass(query, [url], IMPORT_TIMEOUT_MS);
      preferredUrl = url;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!elements) throw lastError;

  const inside = (el: OsmElement) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return lat !== undefined && lon !== undefined && lat >= box.minLat && lat < box.maxLat && lon >= box.minLng && lon < box.maxLng;
  };
  // Aynı dönüşüm ve kara liste (bar/pub/meyhane) liste ile aynı: fromOsm null döndürenler saklanmaz
  const kept = elements.filter((el) => inside(el) && fromOsm(el) !== null);

  const photos = await findOpenPhotos(
    kept.map((el) => ({
      id: `osm:${el.type[0]}${el.id}`,
      commonsFile: commonsFileFromTags(el.tags ?? {}),
      wikidata: el.tags?.wikidata ?? el.tags?.['brand:wikidata'] ?? null,
    })),
  ).catch(() => new Map());

  const rows = kept.map((el) => {
    const id = `osm:${el.type[0]}${el.id}`;
    const photo = photos.get(id);
    return {
      id,
      latitude: (el.lat ?? el.center?.lat)!,
      longitude: (el.lon ?? el.center?.lon)!,
      tags: (el.tags ?? {}) as Prisma.InputJsonValue,
      photoUrl: photo?.url ?? null,
      photoCredit: photo?.attribution ?? null,
      tileKey: key,
    };
  });

  await prisma.$transaction([
    prisma.osmPlace.deleteMany({ where: { tileKey: key } }),
    // Kare sınırındaki bir yer başka karede kayıtlıysa yeniden yazılmaz (skipDuplicates)
    prisma.osmPlace.createMany({ data: rows, skipDuplicates: true }),
    prisma.osmImportTile.upsert({
      where: { key },
      create: { key, importedAt: new Date(), placeCount: rows.length },
      update: { importedAt: new Date(), placeCount: rows.length, failures: 0, requestedAt: null },
    }),
  ]);
  return rows.length;
}

/** Sıradaki kare: önce istenenler, sonra hiç aktarılmamışlar, sonra en eski (bir haftadan eski) olanlar */
async function nextTile(): Promise<string | null> {
  const requested = await prisma.osmImportTile.findFirst({
    where: { importedAt: null, requestedAt: { not: null } },
    orderBy: { requestedAt: 'desc' },
  });
  if (requested) return requested.key;
  const fresh = await prisma.osmImportTile.findFirst({ where: { importedAt: null }, orderBy: { failures: 'asc' } });
  if (fresh) return fresh.key;
  const stale = await prisma.osmImportTile.findFirst({
    where: { importedAt: { lt: new Date(Date.now() - REFRESH_AFTER_MS) } },
    orderBy: { importedAt: 'asc' },
  });
  return stale?.key ?? null;
}

interface Logger {
  info: (obj: object, msg: string) => void;
  warn: (obj: object, msg: string) => void;
}

let running = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sunucuyla birlikte başlar; süreç boyunca yavaşça ve sırayla kareleri aktarır */
export function startOsmImporter(log: Logger) {
  if (running || !env.LIVE_PLACES_ENABLED || !env.OSM_IMPORT_ENABLED) return;
  running = true;
  // Aktarıcıdaki hiçbir hata (veritabanı/ağ) sunucuyu durdurmamalı: her adım yakalanır, beklenip tekrar denenir
  void (async () => {
    let seeded = false;
    let backoff = 60_000;
    for (;;) {
      if (!seeded) {
        seeded = await prisma.osmImportTile
          .createMany({ data: tilesIn(SEED_AREA).map((key) => ({ key })), skipDuplicates: true })
          .then(() => true)
          .catch((err: unknown) => {
            log.warn({ err: String(err) }, 'osm import seeding failed');
            return false;
          });
        if (!seeded) {
          await sleep(backoff);
          continue;
        }
      }
      const key = await nextTile().catch(() => null);
      if (!key) {
        await sleep(IDLE_MS);
        continue;
      }
      try {
        const count = await importTile(key);
        log.info({ tile: key, count }, 'osm tile imported');
        backoff = 60_000;
        await sleep(PAUSE_MS);
      } catch (err) {
        await prisma.osmImportTile.update({ where: { key }, data: { failures: { increment: 1 } } }).catch(() => undefined);
        log.warn({ tile: key, err: String(err), retryInMs: backoff }, 'osm tile import failed');
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }
  })();
}
