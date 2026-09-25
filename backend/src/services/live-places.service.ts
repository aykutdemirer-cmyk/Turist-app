import {
  boundingBox,
  haversineMeters,
  type FoodCategory,
  type LatLng,
  type Locale,
  type NearbyQuery,
  type PriceLevel,
  type VenueDetailDTO,
  type VenueSource,
  type VenueSummaryDTO,
  type VenueType,
} from '@localbite/shared';
import { env } from '../env';
import { notFound } from '../lib/errors';

/**
 * Canlı gerçek mekanlar: veritabanımızda olmayan yakın yerleri dış kaynaktan getirir.
 * GOOGLE_PLACES_API_KEY varsa Google Places (New), yoksa ya da kota/hata olursa OpenStreetMap (Overpass).
 * Sonuçlar salt okunurdur (yorum/teyit/ihbar yok) ve kaynak atfıyla gösterilir.
 */

const CACHE_TTL_MS = 60 * 60 * 1000;
/** Başarısız sorgudan sonra aynı bölge için bekleme (dış servisi dövmeyelim) */
const FAILURE_BACKOFF_MS = 60 * 1000;
const GOOGLE_TIMEOUT_MS = 4_000;
/** Liste isteği canlı veriyi en fazla bu kadar bekler; geç kalan sorgu arka planda önbelleği doldurur */
export const LIVE_WAIT_MS = 3_500;
// Arka planda sürdüğü için istemcinin 10 sn sınırına bağlı değil
const OVERPASS_TIMEOUT_MS = 25_000;
export const MAX_LIVE_RADIUS_M = 3_000;
/** Bölge başına önbellekte tutulan en yakın yer sayısı */
const MAX_LIVE_RESULTS = 1_000;
/** Overpass sonucu mesafeye göre değil kimliğe göre keser: geniş çekip yakındakileri biz seçeriz */
const OVERPASS_FETCH_LIMIT = 3_000;
/** Tek kayıt (paylaşılan bağlantı) için: yalnızca ana sunucu, biraz daha uzun bekleme */
const OVERPASS_LOOKUP_TIMEOUT_MS = 7_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_INDEXED_PLACES = 10_000;
/** Bu mesafedeki (ya da adı benzeyen ve yakın) dış kayıt, veritabanındaki mekanın kopyası sayılır */
const DUPLICATE_RADIUS_M = 40;
const SIMILAR_NAME_RADIUS_M = 150;

const USER_AGENT = 'LocalBite/0.1 (street-food discovery app)';
// Overpass IP başına 2 eşzamanlı sorgu ve sorgu sonrası bekleme uygular; yansılar (kumi vb.) sık sık yanıtsız kalıyor
const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter'];
/** Önbellek hücresi (derece, ~1 km); hücre başına saatte tek dış sorgu */
const CELL_DEG = 0.01;
/** Hücre merkezinden köşesine en fazla ~800 m: sorgu yarıçapı hücredeki her nokta için 3 km'yi kapsar */
const CELL_PAD_M = 800;
const GOOGLE_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_TYPES = ['restaurant', 'meal_takeaway', 'bakery', 'cafe'];
const GOOGLE_FIELDS = [
  'id',
  'displayName',
  'location',
  'priceLevel',
  'primaryType',
  'types',
  'currentOpeningHours.openNow',
  'formattedAddress',
  'nationalPhoneNumber',
  'googleMapsUri',
];

export interface LivePlace {
  id: string;
  source: Exclude<VenueSource, 'LOCALBITE'>;
  name: string;
  latitude: number;
  longitude: number;
  type: VenueType;
  categories: FoodCategory[];
  priceLevel: PriceLevel | null;
  /** null → bilinmiyor */
  openNow: boolean | null;
  address: string | null;
  phone: string | null;
  district: string | null;
  sourceUrl: string;
}

export const isLivePlaceId = (id: string) => id.startsWith('osm:') || id.startsWith('google:');

// ─────────────────────────────────────────────
// Önbellek (bellek içi, 1 saat)
// ─────────────────────────────────────────────

interface CacheEntry {
  places: LivePlace[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<LivePlace[]>>();
/** Detay sayfası için: listede görülen yerleri kimliğiyle bul */
const placeIndex = new Map<string, { place: LivePlace; expiresAt: number }>();

/** Sabit ızgara hücresi: hücredeki tüm kullanıcılar aynı kaydı paylaşır (Overpass kotasını korur) */
function cellOf(center: LatLng) {
  const i = Math.floor(center.latitude / CELL_DEG);
  const j = Math.floor(center.longitude / CELL_DEG);
  return { key: `${i},${j}`, center: { latitude: (i + 0.5) * CELL_DEG, longitude: (j + 0.5) * CELL_DEG } };
}

function remember(key: string, places: LivePlace[], ttl: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  const expiresAt = Date.now() + ttl;
  cache.set(key, { places, expiresAt });
  for (const place of places) {
    placeIndex.delete(place.id);
    if (placeIndex.size >= MAX_INDEXED_PLACES) placeIndex.delete(placeIndex.keys().next().value!);
    placeIndex.set(place.id, { place, expiresAt });
  }
}

/** Test/yönetim için */
export function clearLivePlacesCache() {
  cache.clear();
  placeIndex.clear();
}

// ─────────────────────────────────────────────
// Sınıflandırma (mutfak etiketi → kendi tür/kategorilerimiz)
// ─────────────────────────────────────────────

const CATEGORY_KEYWORDS: [FoodCategory, RegExp][] = [
  ['DONER_WRAP', /kebab|doner|döner|shawarma|durum|dürüm|wrap|kokorec|kokoreç|cig_kofte|çiğ/],
  ['BURGER_TOAST', /burger|sandwich|toast|tost/],
  ['PIDE_PIZZA', /pizza|pide|lahmacun|turkish_pizza/],
  ['SOUP', /soup|corba|çorba|iskembe|işkembe/],
  ['OLIVE_OIL_VEGAN', /vegan|vegetarian|zeytinyag/],
  ['STEW', /turkish|home|regional|anatolian|esnaf|lokanta|ev_yemek|meze|kofte|köfte/],
];

const DESSERT_PATTERN = /bakery|cafe|coffee|tea|dessert|ice_cream|baklava|pastry|patisserie|confectionery/;

export function classify(keywords: string[], fallback: 'fast_food' | 'restaurant'): Pick<LivePlace, 'type' | 'categories'> {
  const text = keywords.join(' ').toLowerCase();
  const categories = CATEGORY_KEYWORDS.filter(([, re]) => re.test(text)).map(([c]) => c);
  let type: VenueType;
  if (DESSERT_PATTERN.test(text) && !categories.length) type = 'DESSERT_TEA';
  else if (categories.includes('DONER_WRAP') || categories.includes('BURGER_TOAST')) type = 'LOCAL_BURGER_WRAP';
  else if (categories.includes('STEW') || categories.includes('SOUP') || categories.includes('OLIVE_OIL_VEGAN'))
    type = 'HOME_COOKING';
  else type = fallback === 'fast_food' ? 'LOCAL_BURGER_WRAP' : 'HOME_COOKING';
  return { type, categories };
}

// ─────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────

class QuotaError extends Error {}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 429 || res.status === 403) throw new QuotaError(`${url} → ${res.status}`);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  location?: { latitude: number; longitude: number };
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  currentOpeningHours?: { openNow?: boolean };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  googleMapsUri?: string;
}

const GOOGLE_PRICE: Record<string, PriceLevel> = {
  PRICE_LEVEL_INEXPENSIVE: 'BUDGET',
  PRICE_LEVEL_MODERATE: 'MODERATE',
};

function fromGoogle(p: GooglePlace): LivePlace | null {
  const price = p.priceLevel ? GOOGLE_PRICE[p.priceLevel] : undefined;
  // Yalnızca uygun fiyatlı (INEXPENSIVE / MODERATE) yerler
  if (!price || !p.location || !p.displayName?.text) return null;
  const types = [p.primaryType ?? '', ...(p.types ?? [])];
  return {
    id: `google:${p.id}`,
    source: 'GOOGLE',
    name: p.displayName.text,
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    ...classify(types, types.includes('meal_takeaway') ? 'fast_food' : 'restaurant'),
    priceLevel: price,
    openNow: p.currentOpeningHours?.openNow ?? null,
    address: p.formattedAddress ?? null,
    phone: p.nationalPhoneNumber ?? null,
    district: null,
    sourceUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
  };
}

async function searchGoogle(key: string, center: LatLng, radius: number, locale: Locale): Promise<LivePlace[]> {
  const data = (await fetchJson(
    GOOGLE_NEARBY_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': GOOGLE_FIELDS.map((f) => `places.${f}`).join(','),
      },
      body: JSON.stringify({
        includedTypes: GOOGLE_TYPES,
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        languageCode: locale,
        locationRestriction: { circle: { center, radius } },
      }),
    },
    GOOGLE_TIMEOUT_MS,
  )) as { places?: GooglePlace[] };
  return (data.places ?? []).map(fromGoogle).filter((p): p is LivePlace => p !== null);
}

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function fromOsm(el: OsmElement): LivePlace | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = tags.name;
  if (lat === undefined || lon === undefined || !name) return null;
  const amenity = tags.amenity === 'fast_food' ? 'fast_food' : 'restaurant';
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  return {
    id: `osm:${el.type[0]}${el.id}`,
    source: 'OSM',
    name,
    latitude: lat,
    longitude: lon,
    ...classify([tags.cuisine ?? '', name, amenity], amenity),
    // OSM'de güvenilir fiyat ve (ayrıştırılmış) açık/kapalı bilgisi yok
    priceLevel: null,
    openNow: null,
    address: street || null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    district: tags['addr:suburb'] ?? tags['addr:district'] ?? null,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

async function overpass(query: string, urls = OVERPASS_URLS, timeoutMs = OVERPASS_TIMEOUT_MS): Promise<OsmElement[]> {
  let lastError: unknown;
  // Ana sunucu yoğunsa aynı sorguyu yansıya (mirror) dene
  for (const url of urls) {
    try {
      const data = (await fetchJson(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        },
        timeoutMs,
      )) as { elements?: OsmElement[] };
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function searchOsm(center: LatLng, radius: number): Promise<LivePlace[]> {
  // Kutu filtresi + kesin etiket eşleşmesi: regex/around'a göre Overpass'ta çok daha ucuz (yoğunlukta 504 almamak için)
  const b = boundingBox(center, radius);
  const bbox = [b.minLat, b.minLng, b.maxLat, b.maxLng].map((n) => n.toFixed(5)).join(',');
  const query =
    `[out:json][timeout:25][bbox:${bbox}];` +
    `(nwr["amenity"="fast_food"]["name"];nwr["amenity"="restaurant"]["name"];);` +
    `out center tags ${OVERPASS_FETCH_LIMIT};`;
  const elements = await overpass(query);
  return elements
    .map(fromOsm)
    .filter((p): p is LivePlace => p !== null)
    .map((p) => ({ p, d: haversineMeters(center, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_LIVE_RESULTS)
    .map(({ p }) => p);
}

async function fetchLivePlaces(center: LatLng, radius: number, locale: Locale, log: Logger): Promise<LivePlace[]> {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (key) {
    try {
      return await searchGoogle(key, center, radius, locale);
    } catch (err) {
      // Kota/yetki hatası ya da zaman aşımı: OSM ile devam
      log.warn({ err: String(err), quota: err instanceof QuotaError }, 'google places failed, falling back to overpass');
    }
  }
  return searchOsm(center, radius);
}

interface Logger {
  warn: (obj: object, msg: string) => void;
}

/**
 * Bölgedeki canlı yerler (önbellekli). Hata ya da LIVE_WAIT_MS aşımında boş liste: uygulama kendi verisiyle
 * çalışmaya devam eder, sürmekte olan sorgu bitince sonuç önbelleğe yazılır (sonraki yenilemede görünür).
 */
export async function findLivePlaces(
  center: LatLng,
  locale: Locale,
  log: Logger,
): Promise<{ places: LivePlace[]; pending: boolean }> {
  if (!env.LIVE_PLACES_ENABLED) return { places: [], pending: false };
  const cell = cellOf(center);
  const key = cell.key;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { places: hit.places, pending: false };

  let pending = inFlight.get(key);
  if (!pending) {
    const stale = hit?.places ?? [];
    pending = fetchLivePlaces(cell.center, MAX_LIVE_RADIUS_M + CELL_PAD_M, locale, log)
      .then((places) => {
        remember(key, places, CACHE_TTL_MS);
        return places;
      })
      .catch((err: unknown) => {
        log.warn({ err: String(err) }, 'live places unavailable');
        // Yenileme başarısızsa eski sonuçlar kısa bir süre daha geçerli (boş liste yerine)
        remember(key, stale, FAILURE_BACKOFF_MS);
        return stale;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  // Süresi dolmuş kayıt varken beklemeyiz: eskiyi hemen döndür, yenisi arka planda gelsin
  if (hit) return { places: hit.places, pending: false };
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), LIVE_WAIT_MS);
  });
  const places = await Promise.race([pending, late]).finally(() => clearTimeout(timer));
  return places ? { places, pending: false } : { places: [], pending: true };
}

// ─────────────────────────────────────────────
// Birleştirme ve DTO
// ─────────────────────────────────────────────

const normalizeName = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function similarNames(a: string, b: string) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 3));
  return nb.split(' ').some((w) => wordsA.has(w));
}

/** Veritabanında zaten olan mekanların dış kopyalarını ele */
export function withoutDuplicates(places: LivePlace[], own: Pick<VenueSummaryDTO, 'name' | 'latitude' | 'longitude'>[]) {
  return places.filter((p) =>
    own.every((v) => {
      const d = haversineMeters(p, v);
      return d > DUPLICATE_RADIUS_M && !(d <= SIMILAR_NAME_RADIUS_M && similarNames(p.name, v.name));
    }),
  );
}

/** Uygulamanın süzgeçleri: fiyatı/açıklığı bilinmeyen yer, o süzgeç açıkken gösterilmez */
export function matchesQuery(p: LivePlace, query: Pick<NearbyQuery, 'category' | 'maxPrice' | 'openNowOnly'>) {
  if (query.category?.length && !query.category.includes(p.type)) return false;
  if (query.maxPrice === 'BUDGET' && p.priceLevel !== 'BUDGET') return false;
  if (query.openNowOnly && p.openNow !== true) return false;
  return true;
}

export function livePlaceSummary(p: LivePlace, origin: LatLng): VenueSummaryDTO {
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    type: p.type,
    isMobile: false,
    source: p.source,
    sourceUrl: p.sourceUrl,
    priceLevel: p.priceLevel,
    openStatusKnown: p.openNow !== null,
    authenticityScore: 0,
    latitude: p.latitude,
    longitude: p.longitude,
    locationNote: null,
    neighborhood: null,
    district: p.district,
    localTips: [],
    categories: p.categories,
    tagline: null,
    distanceMeters: Math.round(haversineMeters(origin, p)),
    isScheduledOpen: p.openNow === true,
    isActiveNow: p.openNow === true,
    lastSpottedAt: null,
    spottedCount: 0,
    spottedTodayCount: 0,
    upvoteCount: 0,
    rating: { average: null, count: 0 },
    coverImageUrl: null,
    coverImageCredit: null,
    isPromoted: false,
    liveLocation: null,
    topReview: null,
    mustTry: [],
  };
}

async function lookupOsm(id: string): Promise<LivePlace | null> {
  const match = /^osm:([nwr])(\d+)$/.exec(id);
  if (!match) return null;
  const kind = { n: 'node', w: 'way', r: 'relation' }[match[1] as 'n' | 'w' | 'r'];
  const elements = await overpass(
    `[out:json][timeout:8];${kind}(${match[2]});out center tags;`,
    OVERPASS_URLS.slice(0, 1),
    OVERPASS_LOOKUP_TIMEOUT_MS,
  );
  return elements.map(fromOsm).find((p) => p !== null) ?? null;
}

/** Dış kaynaklı yerin sade detayı: menü, program, yorum yok; adres/telefon ve kaynak bağlantısı var */
export async function getLivePlaceDetail(id: string): Promise<VenueDetailDTO> {
  const indexed = placeIndex.get(id);
  let place = indexed && indexed.expiresAt > Date.now() ? indexed.place : null;
  // Önbellekte yoksa (ör. paylaşılan bağlantı) OSM'den tek kayıt çekilebilir; Google için listeden gelmek gerekir
  if (!place && id.startsWith('osm:')) place = await lookupOsm(id).catch(() => null);
  if (!place) throw notFound('Venue');

  const { distanceMeters: _distance, mustTry: _mustTry, topReview: _topReview, ...summary } = livePlaceSummary(
    place,
    place,
  );
  return {
    ...summary,
    pricePerPerson: null,
    address: place.address,
    phone: place.phone,
    description: null,
    customTip: null,
    dishes: [],
    schedules: [],
    reviews: [],
    announcements: [],
  };
}
