/**
 * Ücretsiz, açık lisanslı fotoğraflar:
 * OSM'de `wikimedia_commons` / `image` (Commons) / `wikidata` (P18) etiketi olan dükkanın kendi fotoğrafı.
 * Yoksa adındaki yemeğe göre temsili görsel (keywordPhotos) ya da hiç (uygulama tür ikonu gösterir).
 * Wikimedia API'leri ücretsizdir; tanımlayıcı User-Agent ister.
 */

export interface OpenPhoto {
  url: string;
  /** "Yazar · CC BY-SA 4.0" */
  attribution: string | null;
  /** true → mekanın kendisi değil, türünü temsil eden yemek fotoğrafı */
  representative: boolean;
}

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
const TIMEOUT_MS = 6_000;
/** Wikimedia API'leri istek başına en fazla 50 başlık/kimlik kabul eder */
const BATCH = 50;
const THUMB_WIDTH = 800;

// ─────────────────────────────────────────────
// Commons / Wikidata
// ─────────────────────────────────────────────

/** OSM etiketinden Commons dosya adı ("File:Kebap.jpg"); yoksa null */
export function commonsFileFromTags(tags: Record<string, string>): string | null {
  const commons = tags.wikimedia_commons?.trim();
  if (commons?.startsWith('File:')) return commons;
  const image = tags.image?.trim();
  const match = image && /commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/.exec(image);
  return match?.[1] ? decodeURIComponent(match[1]).replace(/_/g, ' ') : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} → ${res.status}`);
  return res.json();
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Wikidata öğelerinin P18 (görsel) dosyaları: Q-id → "File:..." */
async function wikidataImages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const batch of chunks([...new Set(ids)], BATCH)) {
    const data = (await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${batch.join('|')}`,
    )) as { entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }> };
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      const file = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (file) out.set(id, `File:${file}`);
    }
  }
  return out;
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Commons dosyalarının küçük boy adresi ve atfı (yazar + lisans) */
async function commonsInfo(files: string[]): Promise<Map<string, OpenPhoto>> {
  const out = new Map<string, OpenPhoto>();
  for (const batch of chunks([...new Set(files)], BATCH)) {
    const titles = batch.map((f) => encodeURIComponent(f)).join('|');
    const data = (await getJson(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${THUMB_WIDTH}&titles=${titles}`,
    )) as {
      query?: {
        normalized?: { from: string; to: string }[];
        pages?: Record<
          string,
          {
            title: string;
            imageinfo?: { thumburl?: string; url?: string; extmetadata?: Record<string, { value?: string }> }[];
          }
        >;
      };
    };
    // İstenen ad → Commons'ın normalleştirdiği ad (alt çizgi/boşluk vb.)
    const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!url) continue;
      const meta = info?.extmetadata ?? {};
      const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : null;
      const license = meta.LicenseShortName?.value ?? null;
      const attribution = [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons';
      const photo: OpenPhoto = { url, attribution, representative: false };
      out.set(page.title, photo);
      const original = normalized.get(page.title);
      if (original) out.set(original, photo);
    }
  }
  return out;
}

export interface PhotoTarget {
  id: string;
  commonsFile: string | null;
  wikidata: string | null;
}

/**
 * Yerlerin gerçek (Commons) fotoğrafları: yer kimliği → foto. Hata olursa eksik/boş döner
 * (liste yine gelir, temsili fotoğrafa düşülür).
 */
export async function findOpenPhotos(targets: PhotoTarget[]): Promise<Map<string, OpenPhoto>> {
  const result = new Map<string, OpenPhoto>();
  const needWikidata = targets.filter((t) => !t.commonsFile && t.wikidata && /^Q\d+$/.test(t.wikidata));
  const fromWikidata = needWikidata.length ? await wikidataImages(needWikidata.map((t) => t.wikidata!)).catch(() => new Map()) : new Map();

  const fileOf = new Map<string, string>();
  for (const t of targets) {
    const file = t.commonsFile ?? (t.wikidata ? fromWikidata.get(t.wikidata) : undefined);
    if (file) fileOf.set(t.id, file);
  }
  if (!fileOf.size) return result;

  const info = await commonsInfo([...fileOf.values()]).catch(() => new Map<string, OpenPhoto>());
  for (const [id, file] of fileOf) {
    const photo = info.get(file) ?? info.get(file.replace(/_/g, ' '));
    if (photo) result.set(id, photo);
  }
  return result;
}
