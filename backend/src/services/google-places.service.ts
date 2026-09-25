import { haversineMeters, type GooglePlaceDTO, type GoogleReviewDTO, type LatLng, type Locale } from '@localbite/shared';
import { env } from '../env';

/**
 * Dış kaynaklı (OSM) yerin Google Haritalar'daki karşılığını bulup canlı bilgilerini getirir:
 * çalışma saatleri, fotoğraflar, puan ve yorumlar.
 *
 * Google Places kullanım şartları: içerik veritabanına YAZILMAZ; yalnızca bellekte 24 saat tutulur ve
 * gösterilirken "Google Haritalar" atfı yapılır. Anahtar yoksa ya da eşleşme yoksa null (sade OSM kartı).
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** Geçici hata (zaman aşımı, kota) sonrası aynı yer için tekrar deneme aralığı */
const ERROR_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
/** Detay isteği bekletilir: kısa tutulur */
const GOOGLE_TIMEOUT_MS = 5_000;
/** Konum yanlılığı yarıçapı ve kabul edilen en uzak eşleşme */
const BIAS_RADIUS_M = 100;
const MAX_MATCH_DISTANCE_M = 150;
/** Adı benzemiyorsa ancak bu kadar yakınsa aynı yer sayılır */
const SAME_SPOT_M = 30;
const MAX_PHOTOS = 5;
const MAX_REVIEWS = 5;

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACE_URL = 'https://places.googleapis.com/v1/places';
const FIELDS = [
  'id',
  'displayName',
  'location',
  'rating',
  'userRatingCount',
  'currentOpeningHours',
  'regularOpeningHours',
  'photos',
  'reviews',
  'googleMapsUri',
];

/** Uygulamanın fotoğrafı çektiği vekil uç nokta (anahtar istemciye gitmez) */
export const PHOTO_PROXY_PATH = '/api/v1/places/photo';
/** Google fotoğraf kaynak adı: places/{placeId}/photos/{photoRef} */
export const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

interface GoogleText {
  text?: string;
}
interface GoogleAuthor {
  displayName?: string;
  uri?: string;
  photoUri?: string;
}
interface GoogleHours {
  openNow?: boolean;
  nextOpenTime?: string;
  nextCloseTime?: string;
  weekdayDescriptions?: string[];
}
interface GooglePlaceDetails {
  id: string;
  displayName?: GoogleText;
  location?: LatLng;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: GoogleHours;
  regularOpeningHours?: GoogleHours;
  photos?: { name: string; authorAttributions?: GoogleAuthor[] }[];
  reviews?: {
    rating?: number;
    text?: GoogleText;
    originalText?: GoogleText;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    authorAttribution?: GoogleAuthor;
  }[];
  googleMapsUri?: string;
}

interface CacheEntry {
  value: GooglePlaceDTO | null;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<GooglePlaceDTO | null>>();

function remember(key: string, value: GooglePlaceDTO | null, ttl: number) {
  cache.delete(key);
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export const googlePlacesEnabled = () => env.GOOGLE_PLACES_API_KEY !== '';

async function googleFetch(url: string, init: RequestInit & { fieldMask: string }): Promise<unknown> {
  const { fieldMask, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': fieldMask,
      ...rest.headers,
    },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`google places → ${res.status}`);
  return res.json();
}

const fold = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** "Bay Döner" ~ "Baydöner Kadıköy": boşluksuz içerme ya da ortak anlamlı kelime */
export function namesMatch(a: string, b: string) {
  const fa = fold(a);
  const fb = fold(b);
  if (!fa || !fb) return false;
  const ca = fa.replace(/ /g, '');
  const cb = fb.replace(/ /g, '');
  if (ca.includes(cb) || cb.includes(ca)) return true;
  const words = new Set(fa.split(' ').filter((w) => w.length > 3));
  return fb.split(' ').some((w) => words.has(w));
}

/** İstanbul saatiyle "22:00" */
function istanbulTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(date);
}

function toDTO(p: GooglePlaceDetails): GooglePlaceDTO {
  const hours = p.currentOpeningHours ?? p.regularOpeningHours;
  const openNow = p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow ?? null;
  return {
    placeId: p.id,
    mapsUrl: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? 0,
    openNow,
    closesAt: openNow ? istanbulTime(hours?.nextCloseTime) : null,
    opensAt: openNow === false ? istanbulTime(hours?.nextOpenTime) : null,
    weekdayHours: p.regularOpeningHours?.weekdayDescriptions ?? p.currentOpeningHours?.weekdayDescriptions ?? [],
    photos: (p.photos ?? [])
      .filter((ph) => PHOTO_NAME_PATTERN.test(ph.name))
      .slice(0, MAX_PHOTOS)
      .map((ph) => ({
        url: `${PHOTO_PROXY_PATH}?name=${encodeURIComponent(ph.name)}`,
        attribution: ph.authorAttributions?.[0]?.displayName ?? null,
      })),
    reviews: (p.reviews ?? [])
      .filter((r) => (r.text?.text ?? r.originalText?.text) && r.rating)
      .slice(0, MAX_REVIEWS)
      .map(
        (r): GoogleReviewDTO => ({
          authorName: r.authorAttribution?.displayName ?? 'Google',
          authorUrl: r.authorAttribution?.uri ?? null,
          authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
          rating: r.rating!,
          text: (r.text?.text ?? r.originalText?.text)!,
          relativeTime: r.relativePublishTimeDescription ?? null,
          publishedAt: r.publishTime ?? null,
        }),
      ),
  };
}

const fieldMask = (prefix: string) => FIELDS.map((f) => `${prefix}${f}`).join(',');

/** Ad + konumla Text Search; en yakın ve adı tutan sonucu seçer */
async function findByText(name: string, at: LatLng, locale: Locale): Promise<GooglePlaceDetails | null> {
  const data = (await googleFetch(SEARCH_TEXT_URL, {
    method: 'POST',
    fieldMask: fieldMask('places.'),
    body: JSON.stringify({
      textQuery: name,
      languageCode: locale,
      locationBias: { circle: { center: at, radius: BIAS_RADIUS_M } },
    }),
  })) as { places?: GooglePlaceDetails[] };

  const candidates = (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({ p, d: haversineMeters(at, p.location!) }))
    .filter(({ p, d }) => d <= MAX_MATCH_DISTANCE_M && (d <= SAME_SPOT_M || namesMatch(name, p.displayName?.text ?? '')))
    .sort((a, b) => a.d - b.d);
  return candidates[0]?.p ?? null;
}

async function findById(placeId: string, locale: Locale): Promise<GooglePlaceDetails | null> {
  const data = (await googleFetch(`${PLACE_URL}/${encodeURIComponent(placeId)}?languageCode=${locale}`, {
    method: 'GET',
    fieldMask: fieldMask(''),
  })) as GooglePlaceDetails;
  return data.id ? data : null;
}

export interface EnrichTarget extends LatLng {
  id: string;
  name: string;
  /** Google kaynaklı yerde doğrudan kimlikle detay çekilir */
  googlePlaceId?: string;
}

/**
 * Yerin Google bilgileri (24 saat önbellekli). Anahtar yoksa, eşleşme yoksa ya da hata olursa null:
 * çağıran taraf sade karta düşer, istek asla bu yüzden başarısız olmaz.
 */
export async function enrichWithGoogle(target: EnrichTarget, locale: Locale): Promise<GooglePlaceDTO | null> {
  if (!googlePlacesEnabled()) return null;
  const key = `${target.id}|${locale}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = (target.googlePlaceId ? findById(target.googlePlaceId, locale) : findByText(target.name, target, locale))
      .then((place) => {
        const value = place ? toDTO(place) : null;
        remember(key, value, CACHE_TTL_MS);
        return value;
      })
      .catch(() => {
        remember(key, null, ERROR_TTL_MS);
        return null;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Fotoğraf vekili: Google'dan çeker, anahtarı gizler. Anahtar yoksa ya da ad geçersizse null. */
export async function fetchGooglePhoto(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!googlePlacesEnabled() || !PHOTO_NAME_PATTERN.test(name)) return null;
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1000`, {
    headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/jpeg' };
}
