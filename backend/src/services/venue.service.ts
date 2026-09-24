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
import { blockedIdsFor } from './moderation.service';
import { localesFor, pickTranslation } from '../lib/locale';

/**
 * Seyyarların o günkü köşesi varsayılan konumdan uzakta olabilir;
 * bbox ön filtresini bu kadar genişletip kesin mesafeyi sonra hesaplıyoruz.
 */
const MOBILE_VENDOR_MARGIN_M = 1_500;

const MAX_DETAIL_REVIEWS = 10;

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

function toSummary(
  venue: VenueWithRelations,
  locale: Locale,
  origin: LatLng,
  now: Date,
  { spottedToday, ratings, latest }: Aggregates,
): VenueSummaryDTO {
  const status = liveStatus(venue, now);
  const t = pickTranslation(venue.translations, locale);
  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    isMobile: isStreetVendor(venue),
    priceLevel: venue.priceLevel,
    authenticityScore: venue.authenticityScore,
    ...status.position,
    locationNote: status.locationNote,
    neighborhood: venue.neighborhood,
    district: venue.district,
    localTips: venue.localTips,
    categories: foodCategories(venue),
    tagline: t?.tagline ?? null,
    distanceMeters: Math.round(haversineMeters(origin, status.position)),
    isScheduledOpen: status.isScheduledOpen,
    isActiveNow: status.isActiveNow,
    lastSpottedAt: venue.lastSpottedAt?.toISOString() ?? null,
    spottedCount: venue.spottedCount,
    spottedTodayCount: spottedToday.get(venue.id) ?? 0,
    upvoteCount: venue.upvoteCount,
    rating: ratings.get(venue.id) ?? NO_RATING,
    coverImageUrl: venue.coverImageUrl,
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

export async function findNearbyVenues(query: NearbyQuery, locale: Locale, now = new Date()) {
  const origin: LatLng = { latitude: query.lat, longitude: query.lng };
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

  const items = venues
    .map((v) => toSummary(v, locale, origin, now, { spottedToday, ratings, latest }))
    .filter((v) => v.distanceMeters <= query.radius)
    .filter((v) => !query.openNowOnly || v.isActiveNow)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, query.limit);

  return { items, count: items.length, center: origin, radius: query.radius, locale, generatedAt: now.toISOString() };
}

export async function getVenueDetail(
  idOrSlug: string,
  locale: Locale,
  viewerId: string | null = null,
  now = new Date(),
): Promise<VenueDetailDTO> {
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

  return {
    id: venue.id,
    slug: venue.slug,
    name: venue.name,
    type: venue.type,
    isMobile: isStreetVendor(venue),
    priceLevel: venue.priceLevel,
    authenticityScore: venue.authenticityScore,
    ...status.position,
    locationNote: status.locationNote,
    neighborhood: venue.neighborhood,
    district: venue.district,
    address: venue.address,
    phone: venue.phone,
    localTips: venue.localTips,
    categories: foodCategories(venue),
    tagline: t?.tagline ?? null,
    description: t?.description ?? null,
    customTip: t?.customTip ?? null,
    isScheduledOpen: status.isScheduledOpen,
    isActiveNow: status.isActiveNow,
    lastSpottedAt: venue.lastSpottedAt?.toISOString() ?? null,
    spottedCount: venue.spottedCount,
    spottedTodayCount: spottedToday.get(venue.id) ?? 0,
    upvoteCount: venue.upvoteCount,
    rating: ratings.get(venue.id) ?? NO_RATING,
    coverImageUrl: venue.coverImageUrl,
    isPromoted: venue.isPromoted,
    liveLocation: status.liveLocation,
    announcements: venue.announcements.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      content: a.content,
      publishedAt: (a.reviewedAt ?? a.createdAt).toISOString(),
    })),
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
        imageUrl: d.imageUrl,
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
}
