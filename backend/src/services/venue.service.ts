import type { Prisma, VendorSchedule, Venue } from '@prisma/client';
import {
  activeOpenOverride,
  ANNOUNCEMENT_TTL_MS,
  boundingBox,
  findActiveSlot,
  formatMinutes,
  getLocalClock,
  haversineMeters,
  isOpenNow,
  type FoodCategory,
  type LatLng,
  type Locale,
  type NearbyQuery,
  type RatingSummary,
  type ReviewDTO,
  type ReviewSnippetDTO,
  type VenueDetailDTO,
  type VenueSummaryDTO,
} from '@localbite/shared';
import { prisma } from '../db';
import { notFound } from '../lib/errors';
import { publicImageUrl } from '../lib/imageProxy';
import { keywordPhoto } from '../lib/keywordPhotos';
import { parseOpeningHours } from '../lib/openingHours';
import { findLivePlaces, isLivePlaceId, livePlaceSummary, matchesQuery, withoutDuplicates } from './live-places.service';
import { blockedIdsFor } from './moderation.service';
import { googleDetails, type GoogleDetails } from './google-places.service';
import { venueIdForExternal } from './real-venues.service';
import { localesFor, pickTranslation } from '../lib/locale';

/**
 * Seyyarların o günkü köşesi varsayılan konumdan uzakta olabilir;
 * bbox ön filtresini bu kadar genişletip kesin mesafeyi sonra hesaplıyoruz.
 */
const MOBILE_VENDOR_MARGIN_M = 1_500;

// Kaynak filtresi (Tümü / Uygulama / Google) istemcide uygulanır; her kaynaktan yeterince yorum gelsin
const MAX_DETAIL_REVIEWS = 30;

const includeFor = (locale: Locale, mustTryOnly: boolean) =>
  ({
    translations: { where: { locale: { in: localesFor(locale) } } },
    schedules: { orderBy: [{ dayOfWeek: 'asc' }, { openMinute: 'asc' }] },
    dishes: {
      where: mustTryOnly ? { isMustTry: true } : undefined,
      orderBy: { sortOrder: 'asc' },
      take: mustTryOnly ? 3 : undefined,
      include: { translations: { where: { locale: { in: localesFor(locale) } } } },
    },
  }) satisfies Prisma.VenueInclude;

type VenueWithRelations = Prisma.VenueGetPayload<{ include: ReturnType<typeof includeFor> }>;

/** Verilen mekanlar için bugünkü (yerel gün) SPOTTED_TODAY sayıları. Tek sorgu. */
export async function spottedTodayCounts(venueIds: string[], now: Date): Promise<Map<string, number>> {
  if (venueIds.length === 0) return new Map();
  const rows = await prisma.spotReport.groupBy({
    by: ['venueId'],
    where: { venueId: { in: venueIds }, type: 'SPOTTED_TODAY', dayKey: getLocalClock(now).dayKey },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.venueId, r._count._all]));
}

/** Mekan başına ortalama puan ve yorum sayısı. Tek sorgu. */
export async function ratingSummaries(venueIds: string[]): Promise<Map<string, RatingSummary>> {
  if (venueIds.length === 0) return new Map();
  const rows = await prisma.review.groupBy({
    by: ['venueId'],
    where: { venueId: { in: venueIds }, removedAt: null },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    rows.map((r) => [
      r.venueId,
      { average: r._avg.rating === null ? null : Math.round(r._avg.rating * 10) / 10, count: r._count._all },
    ]),
  );
}

const NO_RATING: RatingSummary = { average: null, count: 0 };

type ReviewWithTranslations = Prisma.ReviewGetPayload<{ include: { translations: true } }>;

/** İstenen dil → özgün dil → ilk satır */
function reviewText(r: ReviewWithTranslations, locale: Locale) {
  return (
    r.translations.find((x) => x.locale === locale) ??
    r.translations.find((x) => x.locale === r.originalLocale) ??
    r.translations[0]
  );
}

/** Mekan başına en yeni yorum (harita balonu ve kartlar için). */
export async function latestReviews(venueIds: string[], locale: Locale): Promise<Map<string, ReviewSnippetDTO>> {
  if (venueIds.length === 0) return new Map();
  const rows = await prisma.review.findMany({
    where: { venueId: { in: venueIds }, removedAt: null },
    orderBy: { publishedAt: 'desc' },
    include: { translations: true },
  });
  const byVenue = new Map<string, ReviewSnippetDTO>();
  for (const r of rows) {
    if (byVenue.has(r.venueId)) continue;
    byVenue.set(r.venueId, {
      authorName: r.authorName,
      rating: r.rating,
      source: r.source,
      text: reviewText(r, locale)?.text ?? '',
    });
  }
  return byVenue;
}

interface Aggregates {
  spottedToday: Map<string, number>;
  ratings: Map<string, RatingSummary>;
  latest: Map<string, ReviewSnippetDTO>;
}

export type LiveStatusInput = Pick<
  Venue,
  | 'locationType'
  | 'latitude'
  | 'longitude'
  | 'locationNote'
  | 'lastSpottedAt'
  | 'isLiveLocation'
  | 'liveLatitude'
  | 'liveLongitude'
  | 'lastLocationUpdate'
  | 'openOverride'
  | 'openOverrideAt'
> & {
  schedules: VendorSchedule[];
};

export const isStreetVendor = (venue: Pick<Venue, 'locationType'>) => venue.locationType === 'DYNAMIC_STREET';

/** Saklanan yemek kategorileri + seyyarlara türetilen STREET_CART (tekrarsız) */
export const foodCategories = (venue: Pick<Venue, 'locationType' | 'foodCategories'>): FoodCategory[] => [
  ...new Set<FoodCategory>([...venue.foodCategories, ...(isStreetVendor(venue) ? (['STREET_CART'] as const) : [])]),
];

/**
 * Şu anki program dilimini, seyyarın o anki konumunu ve açık/aktif durumunu hesaplar.
 * Konum önceliği: satıcının canlı konumu → program diliminin köşesi → kayıtlı konum.
 * Açıklık önceliği: satıcının elle "Açık/Kapalı" ayarı (12 saat geçerli) → program + topluluk teyidi.
 */
export function liveStatus(venue: LiveStatusInput, now: Date) {
  const mobile = isStreetVendor(venue);
  const activeSlot = findActiveSlot(venue.schedules, now);
  const live =
    venue.isLiveLocation && venue.liveLatitude != null && venue.liveLongitude != null && venue.lastLocationUpdate
      ? { latitude: venue.liveLatitude, longitude: venue.liveLongitude, updatedAt: venue.lastLocationUpdate }
      : null;
  const useSlotLocation = mobile && activeSlot?.latitude != null && activeSlot.longitude != null;
  const position: LatLng = live
    ? { latitude: live.latitude, longitude: live.longitude }
    : useSlotLocation
      ? { latitude: activeSlot.latitude!, longitude: activeSlot.longitude! }
      : { latitude: venue.latitude, longitude: venue.longitude };

  const override = activeOpenOverride(venue.openOverride, venue.openOverrideAt, now);
  return {
    position,
    // Canlı konumda kayıtlı köşenin tarifi yanıltır
    locationNote: live ? null : (mobile && activeSlot?.locationNote) || venue.locationNote,
    liveLocation: live && { updatedAt: live.updatedAt.toISOString() },
    isScheduledOpen: override ?? activeSlot !== undefined,
    // Topluluk teyidi yalnızca seyyarlar için anlamlı; dükkanlarda program belirleyici.
    isActiveNow: override ?? isOpenNow(venue.schedules, mobile ? venue.lastSpottedAt : null, now),
  };
}

/**
 * Kapak önceliği: mekanın kendi (gerçek) fotoğrafı → menüdeki ilk yemeğin fotoğrafı → türüne göre temsili fotoğraf.
 * Yemekler sortOrder'a göre gelir, böylece ana lezzet (ör. pilav) yan üründen (ayran) önce seçilir.
 */
/** Kapak (Wikimedia görselleri API vekili üzerinden: uygulamanın doğrudan isteği 403 alıyor) */
function coverImage(venue: Parameters<typeof rawCoverImage>[0]) {
  const cover = rawCoverImage(venue);
  return { ...cover, coverImageUrl: publicImageUrl(cover.coverImageUrl) };
}

function rawCoverImage(venue: {
  name: string;
  externalId: string | null;
  coverImageUrl: string | null;
  coverImageCredit: string | null;
  coverIsRepresentative: boolean;
  dishes: { imageUrl: string | null; imageCredit: string | null }[];
}) {
  if (venue.coverImageUrl && !venue.coverIsRepresentative) {
    return { coverImageUrl: venue.coverImageUrl, coverImageCredit: venue.coverImageCredit, coverIsRepresentative: false };
  }
  const dish = venue.dishes.find((d) => d.imageUrl);
  if (dish) return { coverImageUrl: dish.imageUrl, coverImageCredit: dish.imageCredit, coverIsRepresentative: true };
  // Gerçek mekanda saklı temsili görsel yerine adına göre yeniden seçilir; ipucu yoksa ikon (null)
  const byName = venue.externalId ? keywordPhoto(venue.name) : null;
  if (byName) return { coverImageUrl: byName.url, coverImageCredit: byName.attribution, coverIsRepresentative: true };
  return venue.externalId
    ? { coverImageUrl: null, coverImageCredit: null, coverIsRepresentative: false }
    : { coverImageUrl: venue.coverImageUrl, coverImageCredit: venue.coverImageCredit, coverIsRepresentative: venue.coverIsRepresentative };
}

type OpenInfoInput = Pick<
  Venue,
  'externalId' | 'liveCategory' | 'openingHours' | 'openingHoursSource' | 'openOverride' | 'openOverrideAt'
> & { schedules: VendorSchedule[] };

/**
 * Gerçek mekanlarda (haritadan gelen) açık/kapalı: program (VendorSchedule) yoksa OSM sözdizimli saatlerden,
 * İstanbul saatiyle. Esnafın elle "Açık/Kapalı" ayarı her zaman önceliklidir. Saat hiçbir kaynakta yoksa
 * "bilinmiyor" (uydurulmaz).
 */
export function openInfo(venue: OpenInfoInput, status: ReturnType<typeof liveStatus>, locale: Locale, now: Date) {
  const real = venue.externalId !== null;
  const override = activeOpenOverride(venue.openOverride, venue.openOverrideAt, now);
  const parsed = !venue.schedules.length && venue.openingHours ? parseOpeningHours(venue.openingHours, locale, now) : null;
  const open = parsed ? (override ?? parsed.openNow) : null;
  const showNextChange = parsed !== null && override === null;
  return {
    source: real ? ('OSM' as const) : ('LOCALBITE' as const),
    sourceUrl: null,
    isRealPlace: real,
    liveCategory: venue.liveCategory,
    openStatusKnown: !real || venue.schedules.length > 0 || parsed !== null || override !== null,
    isScheduledOpen: open ?? status.isScheduledOpen,
    isActiveNow: open ?? status.isActiveNow,
    closesAt: showNextChange ? parsed.closesAt : null,
    opensAt: showNextChange ? parsed.opensAt : null,
    hoursSource: parsed ? venue.openingHoursSource : real && venue.schedules.length ? ('VENDOR' as const) : null,
    weeklyHours: parsed?.weeklyHours ?? [],
  };
}

function toSummary(
  venue: VenueWithRelations,
  locale: Locale,
  origin: LatLng,
  now: Date,
  { spottedToday, ratings, latest }: Aggregates,
): VenueSummaryDTO {
  const status = liveStatus(venue, now);
  const { weeklyHours: _weekly, ...summaryOpen } = openInfo(venue, status, locale, now);
  const t = pickTranslation(venue.translations, locale);
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    isMobile: isStreetVendor(venue),
    priceLevel: venue.priceLevel,
    ...summaryOpen,
    authenticityScore: venue.authenticityScore,
    ...status.position,
    locationNote: status.locationNote,
    neighborhood: venue.neighborhood,
    district: venue.district,
    localTips: venue.localTips,
    categories: foodCategories(venue),
    tagline: t?.tagline ?? null,
    distanceMeters: Math.round(haversineMeters(origin, status.position)),
    lastSpottedAt: venue.lastSpottedAt?.toISOString() ?? null,
    spottedCount: venue.spottedCount,
    spottedTodayCount: spottedToday.get(venue.id) ?? 0,
    upvoteCount: venue.upvoteCount,
    rating: ratings.get(venue.id) ?? NO_RATING,
    googleRating: null,
    ...coverImage(venue),
    isPromoted: venue.isPromoted,
    liveLocation: status.liveLocation,
    topReview: latest.get(venue.id) ?? null,
    mustTry: venue.dishes.map((d) => ({
      id: d.id,
      localName: d.localName,
      name: pickTranslation(d.translations, locale)?.name ?? d.localName,
    })),
  };
}

type Logger = Parameters<typeof findLivePlaces>[1];
type LivePlace = Awaited<ReturnType<typeof findLivePlaces>>['places'][number];

/**
 * Kalıcı kayda dönüşmüş Google mekanı: Google içeriği veritabanına yazılmadığı için saat ve fotoğraf listede
 * canlı Google sonucundan tamamlanır. Esnafın/topluluğun girdiği saat ve gerçek kapak her zaman önceliklidir.
 */
function withLiveGoogle(summary: VenueSummaryDTO, place: LivePlace | undefined, origin: LatLng, locale: Locale): VenueSummaryDTO {
  if (!place || place.source !== 'GOOGLE') return summary;
  const live = livePlaceSummary(place, origin, locale);
  const hours = summary.openStatusKnown
    ? {}
    : {
        openStatusKnown: live.openStatusKnown,
        isScheduledOpen: live.isScheduledOpen,
        isActiveNow: live.isActiveNow,
        closesAt: live.closesAt,
        opensAt: live.opensAt,
        hoursSource: live.hoursSource,
      };
  const photo =
    (!summary.coverImageUrl || summary.coverIsRepresentative) && live.coverImageUrl && !live.coverIsRepresentative
      ? { coverImageUrl: live.coverImageUrl, coverImageCredit: live.coverImageCredit, coverIsRepresentative: false }
      : {};
  return { ...summary, ...hours, ...photo, googleRating: live.googleRating };
}

export async function findNearbyVenues(query: NearbyQuery, locale: Locale, log: Logger, now = new Date()) {
  const origin: LatLng = { latitude: query.lat, longitude: query.lng };
  // Dış kaynak sorgusu veritabanıyla paralel başlar
  const livePromise = findLivePlaces(origin, log, locale);
  const box = boundingBox(origin, query.radius + MOBILE_VENDOR_MARGIN_M);

  const venues = await prisma.venue.findMany({
    where: {
      status: 'ACTIVE',
      // Kayıtlı konumu ya da satıcının canlı konumu bölgede olanlar
      OR: [
        { latitude: { gte: box.minLat, lte: box.maxLat }, longitude: { gte: box.minLng, lte: box.maxLng } },
        {
          isLiveLocation: true,
          liveLatitude: { gte: box.minLat, lte: box.maxLat },
          liveLongitude: { gte: box.minLng, lte: box.maxLng },
        },
      ],
      type: query.category?.length ? { in: query.category } : undefined,
      priceLevel: query.maxPrice === 'BUDGET' ? 'BUDGET' : undefined,
    },
    include: includeFor(locale, true),
  });

  const ids = venues.map((v) => v.id);
  const [spottedToday, ratings, latest] = await Promise.all([
    spottedTodayCounts(
      venues.filter(isStreetVendor).map((v) => v.id),
      now,
    ),
    ratingSummaries(ids),
    latestReviews(ids, locale),
  ]);

  // Kendi mekanlarımız her zaman listede; kalan yer canlı gerçek mekanlarla dolar
  const { places, pending } = await livePromise;
  const liveById = new Map(places.map((p) => [p.id, p]));

  const own = venues
    .map((v) =>
      withLiveGoogle(
        toSummary(v, locale, origin, now, { spottedToday, ratings, latest }),
        v.externalId ? liveById.get(v.externalId) : undefined,
        origin,
        locale,
      ),
    )
    .filter((v) => v.distanceMeters <= query.radius)
    .filter((v) => !query.openNowOnly || v.isActiveNow)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, query.limit);

  // Kalıcı kayda dönüşmüş gerçek mekanlar veritabanından gelir; haritadaki kopyası elenir
  const ownExternalIds = new Set(venues.map((v) => v.externalId).filter((id): id is string => id !== null));
  const live = withoutDuplicates(places, own, ownExternalIds)
    .filter((p) => matchesQuery(p, query))
    .map((p) => livePlaceSummary(p, origin, locale))
    .filter((v) => v.distanceMeters <= query.radius)
    // Saati bilinmeyen yer "şu an açık" süzgecinde gösterilmez
    .filter((v) => !query.openNowOnly || v.isActiveNow)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, query.limit - own.length);

  const items = [...own, ...live].sort((a, b) => a.distanceMeters - b.distanceMeters);

  return {
    items,
    count: items.length,
    center: origin,
    radius: query.radius,
    locale,
    generatedAt: now.toISOString(),
    livePending: pending,
  };
}

export async function getVenueDetail(
  idOrSlug: string,
  locale: Locale,
  viewerId: string | null = null,
  now = new Date(),
): Promise<VenueDetailDTO> {
  // Haritadaki gerçek mekan ilk açılışta kalıcı kayda dönüşür; sonra her şey küratörlü mekanlar gibi çalışır
  if (isLivePlaceId(idOrSlug)) {
    const id = await venueIdForExternal(idOrSlug);
    if (!id) throw notFound('Venue');
    idOrSlug = id;
  }
  const venue = await prisma.venue.findFirst({
    where: { status: 'ACTIVE', OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      ...includeFor(locale, false),
      announcements: {
        where: { status: 'APPROVED', reviewedAt: { gte: new Date(now.getTime() - ANNOUNCEMENT_TTL_MS) } },
        orderBy: { reviewedAt: 'desc' },
        take: 3,
      },
    },
  });
  if (!venue) throw notFound('Venue');

  const status = liveStatus(venue, now);
  const open = openInfo(venue, status, locale, now);
  const t = pickTranslation(venue.translations, locale);
  const [spottedToday, ratings, reviews] = await Promise.all([
    spottedTodayCounts([venue.id], now),
    ratingSummaries([venue.id]),
    blockedIdsFor(viewerId).then((blocked) =>
      prisma.review.findMany({
        // Kaldırılan yorumlar ve izleyicinin engellediği üyelerin yorumları görünmez (örnek yorumların userId'si null)
        where: {
          venueId: venue.id,
          removedAt: null,
          ...(blocked.length && { OR: [{ userId: null }, { userId: { notIn: blocked } }] }),
        },
        orderBy: { publishedAt: 'desc' },
        take: MAX_DETAIL_REVIEWS,
        include: { translations: true },
      }),
    ),
  ]);

  // Google kaynaklı gerçek mekan: saat, telefon, puan, yorum ve fotoğraf canlı gelir (saklanmaz)
  const google = venue.externalId?.startsWith('google:')
    ? await googleDetails(venue.externalId.slice('google:'.length), locale)
    : null;

  const detail: VenueDetailDTO = {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    isMobile: isStreetVendor(venue),
    priceLevel: venue.priceLevel,
    ...open,
    authenticityScore: venue.authenticityScore,
    ...status.position,
    locationNote: status.locationNote,
    neighborhood: venue.neighborhood,
    district: venue.district,
    address: venue.address,
    addressIsApproximate: venue.addressIsApproximate,
    phone: venue.phone,
    website: venue.website,
    isClaimed: venue.ownerId !== null,
    localTips: venue.localTips,
    categories: foodCategories(venue),
    tagline: t?.tagline ?? null,
    description: t?.description ?? null,
    customTip: t?.customTip ?? null,
    lastSpottedAt: venue.lastSpottedAt?.toISOString() ?? null,
    spottedCount: venue.spottedCount,
    spottedTodayCount: spottedToday.get(venue.id) ?? 0,
    upvoteCount: venue.upvoteCount,
    rating: ratings.get(venue.id) ?? NO_RATING,
    googleRating: google?.dto.rating != null ? { average: google.dto.rating, count: google.dto.userRatingCount } : null,
    ...coverImage(venue),
    isPromoted: venue.isPromoted,
    liveLocation: status.liveLocation,
    announcements: venue.announcements.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      publishedAt: (a.reviewedAt ?? a.createdAt).toISOString(),
    })),
    google: null,
    pricePerPerson:
      venue.avgPriceMinTry !== null && venue.avgPriceMaxTry !== null
        ? { min: venue.avgPriceMinTry, max: venue.avgPriceMaxTry }
        : null,
    reviews: reviews.map((r): ReviewDTO => {
      const text = reviewText(r, locale);
      return {
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        source: r.source,
        sourceUrl: r.sourceUrl,
        publishedAt: r.publishedAt.toISOString(),
        text: text?.text ?? '',
        originalLocale: r.originalLocale,
        isTranslated: text !== undefined && text.locale !== r.originalLocale,
        userId: r.userId,
      };
    }),
    dishes: venue.dishes.map((d) => {
      const dt = pickTranslation(d.translations, locale);
      return {
        id: d.id,
        localName: d.localName,
        name: dt?.name ?? d.localName,
        description: dt?.description ?? null,
        isMustTry: d.isMustTry,
        isVegetarian: d.isVegetarian,
        priceTry: d.priceTry ? Number(d.priceTry) : null,
        portion: d.portion,
        imageUrl: publicImageUrl(d.imageUrl),
        imageCredit: d.imageCredit,
        imageSourceUrl: d.imageSourceUrl,
      };
    }),
    schedules: venue.schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      openMinute: s.openMinute,
      closeMinute: s.closeMinute,
      opensAt: formatMinutes(s.openMinute),
      closesAt: formatMinutes(s.closeMinute),
      latitude: s.latitude,
      longitude: s.longitude,
      locationNote: s.locationNote,
    })),
  };
  return google ? withGoogle(detail, venue, google, now) : detail;
}

/**
 * Google detayını mekan detayına işler. Esnafın/topluluğun kendi girdiği bilgi (program, saat, adres, telefon,
 * kendi fotoğrafı) her zaman önceliklidir; Google yalnızca boşlukları doldurur.
 */
function withGoogle(
  detail: VenueDetailDTO,
  venue: Pick<Venue, 'openingHours' | 'openOverride' | 'openOverrideAt'> & { schedules: VendorSchedule[] },
  google: GoogleDetails,
  now: Date,
): VenueDetailDTO {
  const ownHours =
    venue.schedules.length > 0 || venue.openingHours !== null || activeOpenOverride(venue.openOverride, venue.openOverrideAt, now) !== null;
  const g = google.dto;
  // Kapak: Google fotoğrafı (işletmeninki öncelikli, yoksa Google'ın ilk fotoğrafı); esnafın kapağı her zaman önce
  const photo = g.photos[0];
  const cover = photo ? { url: photo.url, attribution: `${photo.attribution ?? 'Google'} · Google` } : null;
  const ownCover = detail.coverImageUrl !== null && !detail.coverIsRepresentative;
  return {
    ...detail,
    google: g,
    sourceUrl: g.mapsUrl ?? detail.sourceUrl,
    address: detail.address ?? google.address,
    addressIsApproximate: detail.address ? detail.addressIsApproximate : false,
    phone: detail.phone ?? google.phone,
    website: detail.website ?? google.website,
    ...(!ownHours &&
      g.openNow !== null && {
        openStatusKnown: true,
        isScheduledOpen: g.openNow,
        isActiveNow: g.openNow,
        closesAt: g.closesAt,
        opensAt: g.opensAt,
        hoursSource: 'GOOGLE' as const,
        weeklyHours: g.weekdayHours,
      }),
    ...(!ownCover &&
      cover && {
      coverImageUrl: cover.url,
      coverImageCredit: cover.attribution,
      coverIsRepresentative: false,
    }),
  };
}
