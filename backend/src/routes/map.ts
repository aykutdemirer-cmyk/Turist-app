import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { HttpError } from '../lib/errors';

/**
 * Uygulamadaki Leaflet haritası için:
 *  - Leaflet JS/CSS (CDN'e bağımlı olmadan)
 *  - Karo proxy'si + bellek içi önbellek (varsayılan: OpenStreetMap; sade görünüm istemcide CSS filtresiyle)
 *
 * OSM karo politikası: https://operations.osmfoundation.org/policies/tiles/ — tanımlayıcı User-Agent zorunlu,
 * yoğun kullanım yasak. CARTO basemap'leri (Positron) artık API anahtarı istiyor; anahtarsız istekler
 * "API KEY REQUIRED" filigranlı döner. Anahtar alınırsa TILE_UPSTREAM ile geçilir, ör.
 *   https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=...
 * Şablonda {s} (alt alan a–d), {z}/{x}/{y} ve {r} (retina: "@2x") desteklenir.
 */

const require = createRequire(import.meta.url);
const leafletDist = dirname(require.resolve('leaflet/dist/leaflet.js'));

const TILE_UPSTREAM = process.env.TILE_UPSTREAM ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
/** Telefon ekranları yüksek yoğunluklu: 512 px'lik retina karolar 256 px'lik yuvada net görünür */
const TILE_RETINA = '@2x';

function upstreamUrl(z: number, x: number, y: number): string {
  return TILE_UPSTREAM.replace('{s}', 'abcd'[(x + y) % 4]!)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
    .replace('{r}', TILE_RETINA);
}
const TILE_USER_AGENT = 'LocalBite/0.1 (street-food discovery app; development)';
const MAX_CACHED_TILES = 2_000;
const TILE_MAX_ZOOM = 19;

const tileCache = new Map<string, Buffer>(); // ekleme sırası = LRU sırası
const inflight = new Map<string, Promise<Buffer>>();

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const key = `${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) {
    tileCache.delete(key);
    tileCache.set(key, cached);
    return cached;
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(upstreamUrl(z, x, y), { headers: { 'User-Agent': TILE_USER_AGENT } });
      if (!res.ok) throw new HttpError(502, 'TILE_UPSTREAM_ERROR', `Tile server responded ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      tileCache.set(key, buf);
      if (tileCache.size > MAX_CACHED_TILES) tileCache.delete(tileCache.keys().next().value!);
      return buf;
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

const tileParams = z
  .object({
    z: z.coerce.number().int().min(0).max(TILE_MAX_ZOOM),
    x: z.coerce.number().int().min(0),
    y: z.coerce.number().int().min(0),
  })
  .refine(({ z: zoom, x, y }) => x < 2 ** zoom && y < 2 ** zoom, { message: 'Tile out of range' });

export const mapRoutes: FastifyPluginAsyncZod = async (app) => {
  const assets = {
    'leaflet.js': { file: join(leafletDist, 'leaflet.js'), type: 'application/javascript; charset=utf-8' },
    'leaflet.css': { file: join(leafletDist, 'leaflet.css'), type: 'text/css; charset=utf-8' },
  } as const;

  app.get(
    '/map/:asset',
    { schema: { params: z.object({ asset: z.enum(['leaflet.js', 'leaflet.css']) }) } },
    async (req, reply) => {
      const { file, type } = assets[req.params.asset];
      return reply
        .type(type)
        .header('Cache-Control', 'public, max-age=604800')
        .send(await readFile(file));
    },
  );

  // "/tiles/15/19131/12305.png" — .png uzantısı y parametresinden ayrılır
  app.get(
    '/tiles/:z/:x/:y.png',
    { schema: { params: tileParams } },
    async (req, reply) => {
      const { z: zoom, x, y } = req.params;
      const tile = await fetchTile(zoom, x, y);
      return reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(tile);
    },
  );
};
