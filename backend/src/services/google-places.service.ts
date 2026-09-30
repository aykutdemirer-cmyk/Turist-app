import type { GooglePlaceDTO, GoogleReviewDTO, LatLng, Locale } from '@localbite/shared';
import { env } from '../env';

/**
 * Google Places API (New), günlük sınırlarla (sınırlar Railway değişkenleriyle yükseltilebilir):
 * - Liste: Nearby Search, açılış saatleriyle ("Enterprise", ayda 1.000 ücretsiz). Günlük GOOGLE_NEARBY_DAILY_LIMIT.
 * - Detay: Place Details, saat/telefon/puan/yorum ("Enterprise + Atmosphere", ayda 1.000). Günlük GOOGLE_DETAIL_DAILY_LIMIT.
 * - Fotoğraf: Place Photos (ayda 1.000), yalnızca işletmenin kendi yüklediği fotoğraf. Günlük GOOGLE_PHOTO_DAILY_LIMIT.
 * - Dükkân cephesi: Street View Static (ayda 10.000), işletme fotoğrafı yoksa. Günlük GOOGLE_STREETVIEW_DAILY_LIMIT.
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

/** Listede açık/kapalı gösterebilmek için saatler de istenir (istek "Enterprise" sayılır) */
const NEARBY_FIELDS = [
  'id',
  'displayName',
  'location',
  'types',
  'primaryType',
  'shortFormattedAddress',
  'photos',
  'googleMapsUri',
  'businessStatus',
  'regularOpeningHours',
  // Saatlerle aynı ("Enterprise") sınıfta: ek ücret yok
  'rating',
  'userRatingCount',
];
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

interface RawPhoto {
  name: string;
  authorAttributions?: { displayName?: string }[];
}

const normalizeName = (s: string) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Google'daki fotoğrafların çoğunu kullanıcılar yükler; ilk fotoğraf başka bir dükkânı ya da alakasız bir anı
 * gösterebilir. İşletmenin kendi yüklediği fotoğrafın yazarı işletme adıdır: önce o seçilir.
 */
export function pickPhotos(photos: RawPhoto[] | undefined, placeName: string) {
  const valid = (photos ?? []).filter((ph) => PHOTO_NAME_PATTERN.test(ph.name));
  const place = normalizeName(placeName);
  const isOwner = (ph: RawPhoto) => {
    const author = normalizeName(ph.authorAttributions?.[0]?.displayName ?? '');
    return author.length >= 3 && place.length >= 3 && (author.includes(place) || place.includes(author));
  };
  const owner = valid.find(isOwner) ?? null;
  return { owner, first: valid[0] ?? null };
}

// ─────────────────────────────────────────────
// Günlük kota (İstanbul günü). Sunucu yeniden başlarsa sayaç sıfırlanır: asıl güvence Cloud Console'daki
// kota/bütçe ayarlarıdır; buradaki sınırlar ücretsiz aylık kotanın altında kalacak şekilde seçildi.
// ─────────────────────────────────────────────

type QuotaKind = 'nearby' | 'details' | 'photos' | 'streetview';
const usage: Record<QuotaKind, number> & { day: string } = { day: '', nearby: 0, details: 0, photos: 0, streetview: 0 };

function takeQuota(kind: QuotaKind): boolean {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
  if (usage.day !== day) Object.assign(usage, { day, nearby: 0, details: 0, photos: 0, streetview: 0 });
  const limit = {
    nearby: env.GOOGLE_NEARBY_DAILY_LIMIT,
    details: env.GOOGLE_DETAIL_DAILY_LIMIT,
    photos: env.GOOGLE_PHOTO_DAILY_LIMIT,
    streetview: env.GOOGLE_STREETVIEW_DAILY_LIMIT,
  }[kind];
  if (usage[kind] >= limit) return false;
  usage[kind] += 1;
  return true;
}

/** Testler için */
export function resetGoogleQuota() {
  Object.assign(usage, { day: '', nearby: 0, details: 0, photos: 0, streetview: 0 });
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
  /** OpenStreetMap opening_hours sözdizimine çevrilmiş haftalık saatler (bkz. periodsToOsm) */
  openingHours: string | null;
  photoName: string | null;
  photoAuthor: string | null;
  /** Fotoğrafı işletmenin kendisi yüklemiş (kullanıcı fotoğrafları yanlış yeri gösterebilir) */
  photoByOwner: boolean;
  rating: number | null;
  ratingCount: number;
}

interface RawPoint {
  day?: number;
  hour?: number;
  minute?: number;
}
interface RawPeriod {
  open?: RawPoint;
  close?: RawPoint;
}

const OSM_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const hhmm = (p: RawPoint) => `${String(p.hour ?? 0).padStart(2, '0')}:${String(p.minute ?? 0).padStart(2, '0')}`;

/**
 * Google'ın haftalık dönemlerini OSM opening_hours sözdizimine çevirir; böylece açık/kapalı hesabı OSM
 * saatleriyle aynı yoldan yapılır. Gece yarısını geçen dönem "Mo 18:00-02:00" olur (ertesi güne taşar).
 * Kapanışı olmayan tek dönem Google'da "7/24 açık" demektir.
 */
export function periodsToOsm(periods: RawPeriod[] | undefined): string | null {
  if (!periods?.length) return null;
  if (periods.length === 1 && periods[0]!.open && !periods[0]!.close) return '24/7';
  const rules = periods
    .filter((p): p is Required<RawPeriod> => Boolean(p.open && p.close && p.open.day !== undefined))
    .map((p) => {
      const close = hhmm(p.close);
      return `${OSM_DAYS[p.open.day!]} ${hhmm(p.open)}-${close === '00:00' ? '24:00' : close}`;
    });
  return rules.length ? rules.join(', ') : null;
}

interface RawPlace {
  id: string;
  displayName?: { text?: string };
  location?: LatLng;
  types?: string[];
  primaryType?: string;
  shortFormattedAddress?: string;
  formattedAddress?: string;
  photos?: RawPhoto[];
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: { periods?: RawPeriod[] };
  rating?: number;
  userRatingCount?: number;
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
      const { owner, first } = pickPhotos(p.photos, p.displayName.text);
      const photo = owner ?? first;
      results.push({
        id: p.id,
        name: p.displayName.text,
        latitude: p.location.latitude,
        longitude: p.location.longitude,
        types: [p.primaryType ?? '', ...(p.types ?? [])].filter(Boolean),
        address: p.shortFormattedAddress ?? null,
        mapsUrl: p.googleMapsUri ?? null,
        openingHours: periodsToOsm(p.regularOpeningHours?.periods),
        photoName: photo?.name ?? null,
        photoAuthor: photo?.authorAttributions?.[0]?.displayName ?? null,
        photoByOwner: owner !== null,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? 0,
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
interface RawDetails extends Omit<RawPlace, 'regularOpeningHours'> {
  nationalPhoneNumber?: string;
  websiteUri?: string;
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
  const { owner, first } = pickPhotos(p.photos, p.displayName?.text ?? '');
  const photo = owner ?? first;
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
        ? [{ url: photoProxyUrl(photo.name), attribution: photo.authorAttributions?.[0]?.displayName ?? null, byOwner: owner !== null }]
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

interface Photo {
  body: Buffer;
  contentType: string;
}
/** Aynı fotoğraf (liste + detay, farklı kullanıcılar) kotadan tekrar düşmesin: kısa süreli bellek önbelleği */
const PHOTO_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_PHOTO_CACHE_BYTES = 60_000_000;
const photoCache = new Map<string, { photo: Photo; expiresAt: number }>();
const photoInFlight = new Map<string, Promise<Photo | null>>();
let photoCacheBytes = 0;

function forgetPhoto(name: string) {
  const old = photoCache.get(name);
  if (!old) return;
  photoCache.delete(name);
  photoCacheBytes -= old.photo.body.length;
}

function rememberPhoto(name: string, photo: Photo) {
  photoCache.set(name, { photo, expiresAt: Date.now() + PHOTO_CACHE_MS });
  photoCacheBytes += photo.body.length;
  while (photoCacheBytes > MAX_PHOTO_CACHE_BYTES && photoCache.size) forgetPhoto(photoCache.keys().next().value!);
}

/** Fotoğraf vekili: anahtar istemciye gitmez; günlük sınır dolunca null (uygulama ikon gösterir) */
export async function fetchGooglePhoto(name: string): Promise<Photo | null> {
  if (!googleEnabled() || !PHOTO_NAME_PATTERN.test(name)) return null;
  const hit = photoCache.get(name);
  if (hit && hit.expiresAt > Date.now()) return hit.photo;
  forgetPhoto(name);
  let pending = photoInFlight.get(name);
  if (!pending) {
    if (!takeQuota('photos')) return null;
    pending = fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=800`, {
      headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const photo = { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/jpeg' };
        rememberPhoto(name, photo);
        return photo;
      })
      .catch(() => null)
      .finally(() => photoInFlight.delete(name));
    photoInFlight.set(name, pending);
  }
  return pending;
}

// ─────────────────────────────────────────────
// Dükkân cephesi (Street View Static): işletmenin kendi fotoğrafı yoksa kapak. Kamera en yakın panoramadan
// mekana çevrilir; panorama mekandan uzaksa (başka sokak) kullanılmaz.
// ─────────────────────────────────────────────

export const STREETVIEW_PROXY_PATH = '/api/v1/places/streetview';
const STREETVIEW_URL = 'https://maps.googleapis.com/maps/api/streetview';
const STREETVIEW_MAX_DISTANCE_M = 60;

export const streetViewUrl = (latitude: number, longitude: number) =>
  `${STREETVIEW_PROXY_PATH}?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}`;

const toRad = (d: number) => (d * Math.PI) / 180;

/** Panoramadan mekana pusula yönü (derece) */
export function bearing(from: LatLng, to: LatLng): number {
  const y = Math.sin(toRad(to.longitude - from.longitude)) * Math.cos(toRad(to.latitude));
  const x =
    Math.cos(toRad(from.latitude)) * Math.sin(toRad(to.latitude)) -
    Math.sin(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.cos(toRad(to.longitude - from.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function meters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Panorama yoksa tekrar sorulmasın (üst veri ücretsiz ama gereksiz istek olmasın) */
const noPanorama = new Map<string, number>();

/** Mekanın önündeki sokak görüntüsü; panorama yoksa, uzaksa ya da günlük sınır dolduysa null */
export async function fetchStreetView(place: LatLng): Promise<Photo | null> {
  if (!googleEnabled()) return null;
  const key = `sv:${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`;
  const hit = photoCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.photo;
  forgetPhoto(key);
  if ((noPanorama.get(key) ?? 0) > Date.now()) return null;
  let pending = photoInFlight.get(key);
  if (!pending) {
    pending = (async () => {
      const location = `${place.latitude},${place.longitude}`;
      const meta = (await fetch(
        `${STREETVIEW_URL}/metadata?location=${location}&radius=${STREETVIEW_MAX_DISTANCE_M}&source=outdoor&key=${env.GOOGLE_PLACES_API_KEY}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      ).then((r) => (r.ok ? r.json() : null))) as { status?: string; pano_id?: string; location?: { lat: number; lng: number } } | null;
      const pano = meta?.status === 'OK' && meta.pano_id && meta.location ? { id: meta.pano_id, at: { latitude: meta.location.lat, longitude: meta.location.lng } } : null;
      if (!pano || meters(pano.at, place) > STREETVIEW_MAX_DISTANCE_M) {
        noPanorama.set(key, Date.now() + PHOTO_CACHE_MS);
        return null;
      }
      if (!takeQuota('streetview')) return null;
      const heading = Math.round(bearing(pano.at, place));
      const res = await fetch(
        `${STREETVIEW_URL}?size=640x400&pano=${encodeURIComponent(pano.id)}&heading=${heading}&pitch=5&fov=70&return_error_code=true&key=${env.GOOGLE_PLACES_API_KEY}`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!res.ok) return null;
      const photo = { body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? 'image/jpeg' };
      rememberPhoto(key, photo);
      return photo;
    })()
      .catch(() => null)
      .finally(() => photoInFlight.delete(key));
    photoInFlight.set(key, pending);
  }
  return pending;
}
