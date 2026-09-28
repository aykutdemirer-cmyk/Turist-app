import type { GooglePlaceDTO, GoogleReviewDTO, LatLng, Locale } from '@localbite/shared';
import { env } from '../env';

/**
 * Google Places API (New) — yalnızca aylık ÜCRETSİZ kota içinde:
 * - Liste: Nearby Search, yalnızca "Pro" alanları (ayda 5.000 ücretsiz). Günlük sınır GOOGLE_NEARBY_DAILY_LIMIT.
 * - Detay: Place Details, saat/telefon/puan/yorum ("Enterprise + Atmosphere", ayda 1.000). Günlük GOOGLE_DETAIL_DAILY_LIMIT.
 * - Fotoğraf: Place Photos (ayda 1.000), yalnızca detay kapağında. Günlük GOOGLE_PHOTO_DAILY_LIMIT.
 * Sınır dolunca ya da hata olursa null/boş döner; çağıran OpenStreetMap verisine düşer.
 *
 * Google şartları: içerik veritabanına yazılmaz (yalnızca yer kimliği ve konum); yalnızca bellekte kısa süre
 * tutulur, "Google Haritalar" atfıyla ve Google haritası üzerinde gösterilir.
 */

const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACE_URL = 'https://places.googleapis.com/v1/places';
const TIMEOUT_MS = 6_000;
const DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;
const ERROR_CACHE_MS = 5 * 60 * 1000;
const MAX_CACHE = 2_000;
const MAX_REVIEWS = 5;

/** Liste için yalnızca Pro alanları: saat/telefon/puan istenirse istek pahalı (Enterprise) sayılır */
const NEARBY_FIELDS = ['id', 'displayName', 'location', 'types', 'primaryType', 'shortFormattedAddress', 'photos', 'googleMapsUri', 'businessStatus'];
const DETAIL_FIELDS = [
  'id',
  'displayName',
  'location',
  'formattedAddress',
  'nationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'currentOpeningHours',
  'regularOpeningHours',
  'photos',
  'reviews',
  'googleMapsUri',
];
/** Her grup ayrı istek (en fazla 20 yer); kotayı korumak için iki grup */
const TYPE_GROUPS = [
  ['restaurant', 'fast_food_restaurant', 'meal_takeaway'],
  ['bakery', 'dessert_shop', 'sandwich_shop'],
];

export const PHOTO_PROXY_PATH = '/api/v1/places/photo';
export const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export const googleEnabled = () => env.GOOGLE_PLACES_API_KEY !== '';

// ─────────────────────────────────────────────
// Günlük kota (İstanbul günü). Sunucu yeniden başlarsa sayaç sıfırlanır: asıl güvence Cloud Console'daki
// kota/bütçe ayarlarıdır; buradaki sınırlar ücretsiz aylık kotanın altında kalacak şekilde seçildi.
// ─────────────────────────────────────────────

type QuotaKind = 'nearby' | 'details' | 'photos';
const usage: Record<QuotaKind, number> & { day: string } = { day: '', nearby: 0, details: 0, photos: 0 };

function takeQuota(kind: QuotaKind): boolean {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  if (usage.day !== day) Object.assign(usage, { day, nearby: 0, details: 0, photos: 0 });
  const limit = { nearby: env.GOOGLE_NEARBY_DAILY_LIMIT, details: env.GOOGLE_DETAIL_DAILY_LIMIT, photos: env.GOOGLE_PHOTO_DAILY_LIMIT }[kind];
  if (usage[kind] >= limit) return false;
  usage[kind] += 1;
  return true;
}

/** Testler için */
export function resetGoogleQuota() {
  Object.assign(usage, { day: '', nearby: 0, details: 0, photos: 0 });
}

async function googleFetch(url: string, init: RequestInit, fields: string): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': fields,
      ...init.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`google places → ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────
// Liste (Nearby Search Pro)
// ─────────────────────────────────────────────

export interface GoogleNearbyPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  types: string[];
  address: string | null;
  mapsUrl: string | null;
  /** Detay kapağı için (listede kullanılmaz: fotoğraf kotası ayda 1.000) */
  photoName: string | null;
}

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  location?: LatLng;
  types?: string[];
  primaryType?: string;
  shortFormattedAddress?: string;
  formattedAddress?: string;
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
  googleMapsUri?: string;
  businessStatus?: string;
}

/**
 * Yakındaki yemek mekanları (tür grupları, mesafeye göre). Kota dolduysa ya da hata varsa null:
 * çağıran OSM verisine düşer. Kalıcı kapanmış yerler elenir.
 */
export async function googleNearby(center: LatLng, radiusM: number, locale: Locale): Promise<GoogleNearbyPlace[] | null> {
  if (!googleEnabled()) return null;
  const results: GoogleNearbyPlace[] = [];
  for (const includedTypes of TYPE_GROUPS) {
    if (!takeQuota('nearby')) return results.length ? results : null;
    const data = (await googleFetch(
      NEARBY_URL,
      {
        method: 'POST',
        body: JSON.stringify({
          includedTypes,
          excludedTypes: ['bar', 'night_club'],
          maxResultCount: 20,
          rankPreference: 'DISTANCE',
          languageCode: locale,
          locationRestriction: { circle: { center, radius: Math.min(radiusM, 50_000) } },
        }),
      },
      NEARBY_FIELDS.map((f) => `places.${f}`).join(','),
    ).catch(() => null)) as { places?: RawPlace[] } | null;
    if (!data) return results.length ? results : null;
    for (const p of data.places ?? []) {
      if (!p.location || !p.displayName?.text || p.businessStatus === 'CLOSED_PERMANENTLY') continue;
      results.push({
        id: p.id,
        name: p.displayName.text,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        types: [p.primaryType ?? '', ...(p.types ?? [])].filter(Boolean),
        address: p.shortFormattedAddress ?? null,
        mapsUrl: p.googleMapsUri ?? null,
        photoName: p.photos?.find((ph) => PHOTO_NAME_PATTERN.test(ph.name))?.name ?? null,
      });
    }
  }
  const unique = new Map(results.map((r) => [r.id, r]));
  return [...unique.values()];
}

// ─────────────────────────────────────────────
// Detay (Place Details Enterprise + Atmosphere)
// ─────────────────────────────────────────────

export interface GoogleDetails {
  dto: GooglePlaceDTO;
  name: string;
  location: LatLng | null;
  address: string | null;
  phone: string | null;
  website: string | null;
}

interface CacheEntry {
  value: GoogleDetails | null;
  expiresAt: number;
}
const detailCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<GoogleDetails | null>>();

function remember(key: string, value: GoogleDetails | null, ttl: number) {
  detailCache.delete(key);
  if (detailCache.size >= MAX_CACHE) detailCache.delete(detailCache.keys().next().value!);
  detailCache.set(key, { value, expiresAt: Date.now() + ttl });
}

interface RawHours {
  openNow?: boolean;
  nextOpenTime?: string;
  nextCloseTime?: string;
  weekdayDescriptions?: string[];
}
interface RawDetails extends RawPlace {
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: RawHours;
  regularOpeningHours?: RawHours;
  reviews?: {
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
}

/** İstanbul saatiyle "22:00" */
function istanbulTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(date);
}

export const photoProxyUrl = (name: string) => `${PHOTO_PROXY_PATH}?name=${encodeURIComponent(name)}`;

function toDetails(p: RawDetails): GoogleDetails {
  const hours = p.currentOpeningHours ?? p.regularOpeningHours;
  const openNow = p.currentOpeningHours?.openNow ?? p.regularOpeningHours?.openNow ?? null;
  const photo = p.photos?.find((ph) => PHOTO_NAME_PATTERN.test(ph.name));
  return {
    name: p.displayName?.text ?? '',
    location: p.location ?? null,
    address: p.formattedAddress ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    dto: {
      placeId: p.id,
      mapsUrl: p.googleMapsUri ?? null,
      rating: p.rating ?? null,
      userRatingCount: p.userRatingCount ?? 0,
      openNow,
      closesAt: openNow ? istanbulTime(hours?.nextCloseTime) : null,
      opensAt: openNow === false ? istanbulTime(hours?.nextOpenTime) : null,
      weekdayHours: p.regularOpeningHours?.weekdayDescriptions ?? p.currentOpeningHours?.weekdayDescriptions ?? [],
      photos: photo
        ? [{ url: photoProxyUrl(photo.name), attribution: photo.authorAttributions?.[0]?.displayName ?? null }]
        : [],
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
    },
  };
}

/** Google yer kimliğiyle canlı detay (24 saat bellekte). Kota/hata → null. */
export async function googleDetails(placeId: string, locale: Locale): Promise<GoogleDetails | null> {
  if (!googleEnabled()) return null;
  const key = `${placeId}|${locale}`;
  const hit = detailCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  let pending = inFlight.get(key);
  if (!pending) {
    if (!takeQuota('details')) return null;
    pending = googleFetch(
      `${PLACE_URL}/${encodeURIComponent(placeId)}?languageCode=${locale}`,
      { method: 'GET' },
      DETAIL_FIELDS.join(','),
    )
      .then((raw) => {
        const value = (raw as RawDetails).id ? toDetails(raw as RawDetails) : null;
        remember(key, value, DETAIL_CACHE_MS);
        return value;
      })
      .catch(() => {
        remember(key, null, ERROR_CACHE_MS);
        return null;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Fotoğraf vekili: anahtar istemciye gitmez; günlük sınır dolunca null (uygulama ikon gösterir) */
export async function fetchGooglePhoto(name: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (!googleEnabled() || !PHOTO_NAME_PATTERN.test(name) || !takeQuota('photos')) return null;
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=1000`, {
    headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/jpeg' };
}
