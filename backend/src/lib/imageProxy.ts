/**
 * Wikimedia görsel vekili. Wikimedia'nın görsel sunucuları tanımlayıcı olmayan istemcileri (ör. Android'in
 * varsayılan "okhttp" kimliği) 403 ile reddediyor; bu yüzden Commons görselleri uygulamaya doğrudan değil,
 * API üzerinden (tanımlayıcı User-Agent ile) verilir. Yalnızca Wikimedia adreslerine izin verilir.
 */

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
const ALLOWED_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5_000_000;
/** Bellek önbelleği: aynı görsel her istekte Wikimedia'dan çekilmesin */
const MAX_CACHED = 300;
const MAX_CACHE_BYTES = 80_000_000;

export const WIKIMEDIA_PROXY_PATH = '/media/wikimedia';

export function isWikimediaUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Uygulamaya verilecek görsel adresi: Wikimedia ise vekil yolu (göreli, API adresine göre çözülür), değilse aynen */
export function publicImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return isWikimediaUrl(url) ? `${WIKIMEDIA_PROXY_PATH}?url=${encodeURIComponent(url)}` : url;
}

interface Cached {
  body: Buffer;
  contentType: string;
}
const cache = new Map<string, Cached>();
let cachedBytes = 0;

function remember(key: string, value: Cached) {
  cache.set(key, value);
  cachedBytes += value.body.length;
  while ((cache.size > MAX_CACHED || cachedBytes > MAX_CACHE_BYTES) && cache.size) {
    const [oldKey, old] = cache.entries().next().value!;
    cache.delete(oldKey);
    cachedBytes -= old.body.length;
  }
}

export async function fetchWikimediaImage(raw: string): Promise<Cached | null> {
  if (!isWikimediaUrl(raw)) return null;
  const hit = cache.get(raw);
  if (hit) {
    // LRU: son kullanılanı sona taşı
    cache.delete(raw);
    cache.set(raw, hit);
    return hit;
  }
  const res = await fetch(raw, {
    headers: { 'User-Agent': USER_AGENT },
    // Yönlendirme başka bir sunucuya gitmesin
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return null;
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) return null;
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length > MAX_BYTES) return null;
  const value = { body, contentType };
  remember(raw, value);
  return value;
}
