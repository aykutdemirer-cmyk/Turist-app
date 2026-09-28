import {
  boundingBox,
  haversineMeters,
  type FoodCategory,
  type LatLng,
  type LiveCategory,
  type Locale,
  type NearbyQuery,
  type PriceLevel,
  type VenueSource,
  type VenueSummaryDTO,
  type VenueType,
} from '@localbite/shared';
import { prisma } from '../db';
import { env } from '../env';
import { parseOpeningHours, type ParsedHours } from '../lib/openingHours';
import { keywordPhoto } from '../lib/keywordPhotos';
import { commonsFileFromTags, findOpenPhotos, type OpenPhoto } from '../lib/openPhotos';
import { googleDetails, googleEnabled, googleNearby, type GoogleNearbyPlace } from './google-places.service';
import { requestTilesNear } from './osm-import.service';

/**
 * Canlı gerçek mekanlar: veritabanımızda olmayan yakın yerleri OpenStreetMap'ten (Overpass, ücretsiz) getirir.
 * Yer ilk açıldığında kalıcı mekan kaydına dönüşür (real-venues.service); o andan sonra listede veritabanından gelir.
 */

const CACHE_TTL_MS = 60 * 60 * 1000;
/** Başarısız sorgudan sonra aynı bölge için bekleme (dış servisi dövmeyelim) */
const FAILURE_BACKOFF_MS = 60 * 1000;
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
// Overpass IP başına 2 eşzamanlı sorgu ve sorgu sonrası bekleme uygular; yoğunlukta 504 verir. mail.ru yansısı
// o sırada çoğunlukla yanıt veriyor (kumi, private.coffee sık sık yanıtsız)
export const OVERPASS_URLS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
/** Önbellek hücresi (derece, ~1 km); hücre başına saatte tek dış sorgu */
const CELL_DEG = 0.01;
/** Hücre merkezinden köşesine en fazla ~800 m: sorgu yarıçapı hücredeki her nokta için 3 km'yi kapsar */
const CELL_PAD_M = 800;
export interface LivePlace {
  id: string;
  source: Exclude<VenueSource, 'LOCALBITE'>;
  name: string;
  latitude: number;
  longitude: number;
  type: VenueType;
  categories: FoodCategory[];
  /** Gösterilen etiket (tür etiketi yerine) */
  liveCategory: LiveCategory;
  priceLevel: PriceLevel | null;
  /** OSM `opening_hours` ham değeri; istek anında İstanbul saatiyle yorumlanır (önbellekteki yer bayatlamaz) */
  openingHours: string | null;
  address: string | null;
  phone: string | null;
  district: string | null;
  /** Dükkanın kendi web sitesi (OSM website/contact:website) */
  website: string | null;
  sourceUrl: string;
  /** OSM mutfak etiketi ("kebab;turkish"); temsili görsel seçiminde addan sonra ikinci ipucu */
  cuisine: string | null;
  /** Kapak: dükkanın Commons/Wikidata fotoğrafı, yoksa adındaki yemeğin temsili görseli, yoksa null (ikon) */
  photo: OpenPhoto | null;
}

export const isLivePlaceId = (id: string) => /^(osm:[nwr]\d+|google:[A-Za-z0-9_-]+)$/.test(id);

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
  ['PIDE_PIZZA', /pizza|pide|lahmacun|turkish_pizza|borek|börek/],
  ['SOUP', /soup|corba|çorba|iskembe|işkembe/],
  ['OLIVE_OIL_VEGAN', /vegan|vegetarian|zeytinyag/],
  // Yalnızca adında/etiketinde açıkça esnaf/lokanta geçenler; "turkish" gibi genel mutfak etiketi yetmez
  ['STEW', /esnaf|lokanta|ev_yemek|ev yemek|sulu yemek/],
];

const KEBAB_PATTERN = /kebab|kebap|doner|döner|shawarma|durum|dürüm|turkish|kokorec|kokoreç|cig_kofte/;
const PIDE_PATTERN = /pizza|pide|lahmacun|turkish_pizza|borek|börek/;
const DESSERT_PATTERN = /bakery|cafe|coffee|tea|dessert|ice_cream|baklava|pastry|patisserie|confectionery|firin|fırın|pastane/;

export type PlaceKind = 'fast_food' | 'restaurant' | 'bakery';

/**
 * Dış kaynaklı yerin türü (ikon/katman/süzgeç) ve gösterilen etiketi.
 * Bilinmeyen yer "Yerel restoran" olur; doğrulanmamış hiçbir yere "Esnaf lokantası" denmez.
 */
export function classify(keywords: string[], kind: PlaceKind): Pick<LivePlace, 'type' | 'categories' | 'liveCategory'> {
  const text = keywords.join(' ').toLocaleLowerCase('tr');
  const categories = CATEGORY_KEYWORDS.filter(([, re]) => re.test(text)).map(([c]) => c);
  const liveCategory: LiveCategory = KEBAB_PATTERN.test(text)
    ? 'KEBAB_WRAP'
    : PIDE_PATTERN.test(text)
      ? 'PIDE_BOREK'
      : kind === 'bakery' || (DESSERT_PATTERN.test(text) && !categories.length)
        ? 'BAKERY_DESSERT'
        : kind === 'fast_food'
          ? 'STREET_FOOD'
          : 'LOCAL_RESTAURANT';
  const type: VenueType =
    liveCategory === 'BAKERY_DESSERT'
      ? 'DESSERT_TEA'
      : liveCategory === 'KEBAB_WRAP' || liveCategory === 'STREET_FOOD' || categories.includes('BURGER_TOAST')
        ? 'LOCAL_BURGER_WRAP'
        : 'HOME_COOKING';
  return { type, categories, liveCategory };
}

// ─────────────────────────────────────────────
// Kara liste: bar, gece kulübü, meyhane vb. sokak yemeği/esnaf konseptine uymaz
// ─────────────────────────────────────────────

const EXCLUDED_TYPES = new Set([
  'bar',
  'pub',
  'night_club',
  'nightclub',
  'biergarten',
  'beer_garden',
  'lounge',
  'lounge_bar',
  'hookah_lounge',
  'hookah_bar',
  'wine_bar',
  'cocktail_bar',
  'sports_bar',
  'karaoke',
  'casino',
  'liquor_store',
]);
// Unicode harf sınırı (\b Türkçe harflerde çalışmaz)
const word = (alternatives: string) => new RegExp(`(^|[^\p{L}])(${alternatives})($|[^\p{L}])`, 'iu');
/** Bu kelimeler adda geçerse her zaman elenir */
const ALWAYS_EXCLUDED_NAME = word('meyhane|meyhanesi|pub|club|klub|kulüp|kulübü|lounge|nargile|hookah|birahane|bira evi|wine|şarap|sarap|cocktail|kokteyl|disco|disko|gece kulübü');
/** "bar" yalnızca adda yemek belirten bir kelime yoksa eler ("Döner Bar", "Çorba Bar" kalır) */
const BAR_NAME = word('bar|barı|bistro bar');
const FOOD_WORDS = word(
  'döner|doner|kebap|kebab|dürüm|durum|pilav|çorba|corba|köfte|kofte|burger|pide|lahmacun|tost|salata|makarna|mantı|manti|börek|borek|kokoreç|kokorec|balık|balik|falafel|waffle|kumpir|midye',
);

export function isExcludedPlace(name: string, types: string[]): boolean {
  if (types.some((t) => EXCLUDED_TYPES.has(t))) return true;
  if (ALWAYS_EXCLUDED_NAME.test(name)) return true;
  return BAR_NAME.test(name) && !FOOD_WORDS.test(name);
}

// ─────────────────────────────────────────────
// Kaynaklar
// ─────────────────────────────────────────────

async function fetchJson(url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function fromOsm(el: OsmElement): LivePlace | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const name = tags.name;
  if (lat === undefined || lon === undefined || !name) return null;
  const kind: PlaceKind = tags.shop === 'bakery' ? 'bakery' : tags.amenity === 'fast_food' ? 'fast_food' : 'restaurant';
  // İçkili/eğlence mekanı: bar alanı olan restoran, bar/pub mutfağı ya da adında meyhane/pub/club...
  const cuisine = (tags.cuisine ?? '').toLowerCase();
  if (tags.bar === 'yes' || /(^|;)\s*(bar|pub|meyhane|wine|cocktail|hookah)\s*(;|$)/.test(cuisine)) return null;
  if (isExcludedPlace(name, [tags.amenity ?? ''])) return null;
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const area = tags['addr:neighbourhood'] ?? tags['addr:suburb'] ?? tags['addr:quarter'];
  const district = tags['addr:district'] ?? tags['addr:city'];
  // Adres yalnızca sokak biliniyorsa (tek başına ilçe adı adres sayılmaz)
  const fullAddress = street ? [street, area, district].filter((p, i, all) => p && all.indexOf(p) === i).join(', ') : null;
  // "0216 ...; 0532 ..." gibi birden çok numarada ilki
  const phone = (tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'])?.split(';')[0]?.trim() || null;
  return {
    id: `osm:${el.type[0]}${el.id}`,
    source: 'OSM',
    name,
    latitude: lat,
    longitude: lon,
    ...classify([cuisine, name, tags.shop ?? ''], kind),
    // OSM'de güvenilir fiyat bilgisi yok
    priceLevel: null,
    openingHours: tags.opening_hours ?? null,
    address: fullAddress,
    phone,
    district: tags['addr:suburb'] ?? tags['addr:district'] ?? null,
    website: tags.website ?? tags['contact:website'] ?? null,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    cuisine: cuisine || null,
    photo: null,
  };
}

/** Yemek mekanı filtresi (kutu filtresiyle birlikte kullanılır) */
export const OSM_FOOD_FILTER = '(nwr["amenity"="fast_food"]["name"];nwr["amenity"="restaurant"]["name"];nwr["shop"="bakery"]["name"];);';

export async function overpass(query: string, urls = OVERPASS_URLS, timeoutMs = OVERPASS_TIMEOUT_MS): Promise<OsmElement[]> {
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
    OSM_FOOD_FILTER +
    `out center tags ${OVERPASS_FETCH_LIMIT};`;
  const elements = await overpass(query);
  const nearest = elements
    .map((el) => ({ el, p: fromOsm(el) }))
    .filter((x): x is { el: OsmElement; p: LivePlace } => x.p !== null)
    .map((x) => ({ ...x, d: haversineMeters(center, x.p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_LIVE_RESULTS);
  return withOpenPhotos(nearest);
}

/**
 * Ücretsiz fotoğraflar: OSM'deki Commons/Wikidata bağlantısından dükkanın kendi fotoğrafı,
 * yoksa türüne göre lisanslı temsili yemek fotoğrafı. Wikimedia'ya ulaşılamazsa hepsi temsili olur.
 */
async function withOpenPhotos(items: { el: OsmElement; p: LivePlace }[]): Promise<LivePlace[]> {
  const real = await findOpenPhotos(
    items.map(({ el, p }) => ({
      id: p.id,
      commonsFile: commonsFileFromTags(el.tags ?? {}),
      wikidata: el.tags?.wikidata ?? el.tags?.['brand:wikidata'] ?? null,
    })),
  ).catch(() => new Map<string, OpenPhoto>());
  return items.map(({ p }) => ({ ...p, photo: real.get(p.id) ?? keywordPhoto(`${p.name} ${p.cuisine ?? ''}`) }));
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
  log: Logger,
  locale: Locale = 'tr',
): Promise<{ places: LivePlace[]; pending: boolean }> {
  if (!env.LIVE_PLACES_ENABLED) return { places: [], pending: false };
  // Google anahtarı varsa önce Google (ücretsiz kota içinde); kota/hata → OpenStreetMap
  if (googleEnabled()) {
    const google = await googlePlacesNear(center, locale, log).catch(() => null);
    if (google?.length) return { places: google, pending: false };
  }
  // Önce içe aktarılmış OSM kopyası (hızlı, dış sunucuya bağlı değil); bölge henüz aktarılmadıysa öne alınır
  void requestTilesNear(center, MAX_LIVE_RADIUS_M).catch(() => undefined);
  const stored = await placesFromDb(center, MAX_LIVE_RADIUS_M).catch(() => []);
  if (stored.length) return { places: stored, pending: false };
  const cell = cellOf(center);
  const key = cell.key;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { places: hit.places, pending: false };

  let pending = inFlight.get(key);
  if (!pending) {
    const stale = hit?.places ?? [];
    pending = searchOsm(cell.center, MAX_LIVE_RADIUS_M + CELL_PAD_M)
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

/** Veritabanında zaten olan mekanların (kalıcı kayda dönüşmüş olanlar dahil) dış kopyalarını ele */
export function withoutDuplicates(
  places: LivePlace[],
  own: Pick<VenueSummaryDTO, 'name' | 'latitude' | 'longitude'>[],
  ownExternalIds: Set<string> = new Set(),
) {
  return places.filter(
    (p) =>
      !ownExternalIds.has(p.id) &&
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
  return true;
}

interface HoursResult {
  hours: ParsedHours | null;
  source: VenueSummaryDTO['hoursSource'];
}

/** Anlık açık/kapalı: OSM saatlerinin şimdiki (İstanbul) yorumu; saat yoksa bilinmiyor */
function currentHours(p: LivePlace, locale: Locale): HoursResult {
  const osm = p.openingHours ? parseOpeningHours(p.openingHours, locale) : null;
  return osm ? { hours: osm, source: 'OSM' } : { hours: null, source: null };
}

export function livePlaceSummary(p: LivePlace, origin: LatLng, locale: Locale): VenueSummaryDTO {
  return summaryWithHours(p, origin, currentHours(p, locale));
}

function summaryWithHours(p: LivePlace, origin: LatLng, { hours, source }: HoursResult): VenueSummaryDTO {
  return {
    id: p.id,
    slug: p.id,
    name: p.name,
    type: p.type,
    isMobile: false,
    source: p.source,
    sourceUrl: p.sourceUrl,
    priceLevel: p.priceLevel,
    openStatusKnown: hours !== null,
    liveCategory: p.liveCategory,
    closesAt: hours?.closesAt ?? null,
    opensAt: hours?.opensAt ?? null,
    hoursSource: source,
    isRealPlace: true,
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
    isScheduledOpen: hours?.openNow === true,
    isActiveNow: hours?.openNow === true,
    lastSpottedAt: null,
    spottedCount: 0,
    spottedTodayCount: 0,
    upvoteCount: 0,
    rating: { average: null, count: 0 },
    coverImageUrl: p.photo?.url ?? null,
    coverImageCredit: p.photo?.attribution ?? null,
    coverIsRepresentative: p.photo?.representative ?? false,
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
  const found = elements.map((el) => ({ el, p: fromOsm(el) })).find((x): x is { el: OsmElement; p: LivePlace } => x.p !== null);
  return found ? ((await withOpenPhotos([found]))[0] ?? null) : null;
}

interface OsmPlaceRow {
  id: string;
  latitude: number;
  longitude: number;
  tags: unknown;
  photoUrl: string | null;
  photoCredit: string | null;
}

/** Veritabanındaki OSM kaydını, anlık sorgudakiyle aynı dönüşümle (kara liste, etiket, adres) yere çevirir */
function placeFromRow(row: OsmPlaceRow): LivePlace | null {
  const match = /^osm:([nwr])(\d+)$/.exec(row.id);
  if (!match) return null;
  const type = ({ n: 'node', w: 'way', r: 'relation' } as const)[match[1] as 'n' | 'w' | 'r'];
  const place = fromOsm({ type, id: Number(match[2]), lat: row.latitude, lon: row.longitude, tags: row.tags as Record<string, string> });
  if (!place) return null;
  return {
    ...place,
    photo: row.photoUrl
      ? { url: row.photoUrl, attribution: row.photoCredit, representative: false }
      : keywordPhoto(`${place.name} ${place.cuisine ?? ''}`),
  };
}

async function placesFromDb(center: LatLng, radius: number): Promise<LivePlace[]> {
  const b = boundingBox(center, radius);
  const rows = await prisma.osmPlace.findMany({
    where: { latitude: { gte: b.minLat, lte: b.maxLat }, longitude: { gte: b.minLng, lte: b.maxLng } },
  });
  return rows
    .map(placeFromRow)
    .filter((p): p is LivePlace => p !== null)
    .map((p) => ({ p, d: haversineMeters(center, p) }))
    .filter(({ d }) => d <= radius)
    .sort((a, b2) => a.d - b2.d)
    .slice(0, MAX_LIVE_RESULTS)
    .map(({ p }) => p);
}

/** Kimliğiyle gerçek yer: önce içe aktarılmış kopya, sonra listede görülenler, yoksa OSM'den tek kayıt */
export async function findLivePlace(id: string, locale: Locale = 'tr'): Promise<LivePlace | null> {
  if (id.startsWith('google:')) return findGooglePlace(id, locale);
  const row = await prisma.osmPlace.findUnique({ where: { id } }).catch(() => null);
  const stored = row && placeFromRow(row);
  if (stored) return stored;
  const indexed = placeIndex.get(id);
  if (indexed && indexed.expiresAt > Date.now()) return indexed.place;
  return id.startsWith('osm:') ? lookupOsm(id).catch(() => null) : null;
}

// ─────────────────────────────────────────────
// Google (liste): hücre başına 1 saat bellekte; içerik veritabanına yazılmaz
// ─────────────────────────────────────────────

/** Google yerini uygulamanın yer modeline çevirir (bar/pub/meyhane kara listesi burada da geçerli) */
function fromGoogle(g: GoogleNearbyPlace): LivePlace | null {
  if (isExcludedPlace(g.name, g.types)) return null;
  const kind: PlaceKind = g.types.includes('bakery')
    ? 'bakery'
    : g.types.some((t) => t === 'fast_food_restaurant' || t === 'meal_takeaway')
      ? 'fast_food'
      : 'restaurant';
  const keywords = `${g.name} ${g.types.join(' ')}`;
  return {
    id: `google:${g.id}`,
    source: 'GOOGLE',
    name: g.name,
    latitude: g.latitude,
    longitude: g.longitude,
    ...classify([...g.types, g.name], kind),
    priceLevel: null,
    // Saat, telefon, puan detayda (pahalı alanlar listede istenmez)
    openingHours: null,
    address: g.address,
    phone: null,
    district: null,
    website: null,
    sourceUrl: g.mapsUrl ?? `https://www.google.com/maps/place/?q=place_id:${g.id}`,
    cuisine: g.types.join(' '),
    // Listede Google fotoğrafı kullanılmaz (fotoğraf kotası ayda 1.000): addan temsili görsel ya da ikon
    photo: keywordPhoto(keywords),
  };
}

async function googlePlacesNear(center: LatLng, locale: Locale, log: Logger): Promise<LivePlace[] | null> {
  const cell = cellOf(center);
  const key = `g:${cell.key}:${locale}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.places;
  const found = await googleNearby(cell.center, MAX_LIVE_RADIUS_M + CELL_PAD_M, locale);
  if (!found) {
    log.warn({}, 'google nearby unavailable (quota or error), falling back to osm');
    return null;
  }
  const places = found.map(fromGoogle).filter((p): p is LivePlace => p !== null);
  remember(key, places, CACHE_TTL_MS);
  return places;
}

/** Google yeri kimliğiyle: listede görüldüyse bellekten, yoksa Google detayından (detay kotasından düşer) */
async function findGooglePlace(id: string, locale: Locale): Promise<LivePlace | null> {
  const indexed = placeIndex.get(id);
  if (indexed && indexed.expiresAt > Date.now()) return indexed.place;
  const details = await googleDetails(id.slice('google:'.length), locale);
  if (!details?.location) return null;
  return fromGoogle({
    id: details.dto.placeId,
    name: details.name,
    latitude: details.location.latitude,
    longitude: details.location.longitude,
    types: [],
    address: details.address,
    mapsUrl: details.dto.mapsUrl,
    photoName: null,
  });
}
