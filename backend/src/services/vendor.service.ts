import type { Prisma } from '@prisma/client';
import {
  activeOpenOverride,
  haversineMeters,
  type Locale,
  type VendorAnnouncementDTO,
  type VendorAnnouncementInput,
  type VendorDishInput,
  type VendorLocationInput,
  type VendorVenueDTO,
} from '@localbite/shared';
import { prisma } from '../db';
import { assertAcceptableContent } from '../lib/contentFilter';
import { HttpError, notFound } from '../lib/errors';
import { localesFor, pickTranslation } from '../lib/locale';
import { isStreetVendor, liveStatus } from './venue.service';

/** Canlı konum kayıtlı köşeden en fazla bu kadar uzak olabilir (yanlış tıklama / kötüye kullanım) */
export const MAX_LIVE_DISTANCE_FROM_BASE_M = 25_000;
/** Onay bekleyen duyuru sınırı: kuyruğu doldurmasın */
const MAX_PENDING_ANNOUNCEMENTS = 3;

const vendorInclude = (locale: Locale) =>
  ({
    schedules: true,
    dishes: {
      orderBy: { sortOrder: 'asc' },
      include: { translations: { where: { locale: { in: localesFor(locale) } } } },
    },
    announcements: { orderBy: { createdAt: 'desc' }, take: 20 },
  }) satisfies Prisma.VenueInclude;

type VendorVenue = Prisma.VenueGetPayload<{ include: ReturnType<typeof vendorInclude> }>;

export const toAnnouncementDTO = (a: VendorVenue['announcements'][number]): VendorAnnouncementDTO => ({
  id: a.id,
  type: a.type,
  title: a.title,
  content: a.content,
  status: a.status,
  createdAt: a.createdAt.toISOString(),
  reviewedAt: a.reviewedAt?.toISOString() ?? null,
});

function toVendorVenue(v: VendorVenue, locale: Locale, now: Date): VendorVenueDTO {
  const status = liveStatus(v, now);
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    type: v.type,
    locationType: v.locationType,
    status: v.status,
    baseLocation: { latitude: v.latitude, longitude: v.longitude },
    liveLocation:
      v.isLiveLocation && v.liveLatitude != null && v.liveLongitude != null && v.lastLocationUpdate
        ? { latitude: v.liveLatitude, longitude: v.liveLongitude, updatedAt: v.lastLocationUpdate.toISOString() }
        : null,
    isOpenNow: status.isActiveNow,
    openOverride: activeOpenOverride(v.openOverride, v.openOverrideAt, now),
    dishes: v.dishes.map((d) => ({
      id: d.id,
      localName: d.localName,
      name: pickTranslation(d.translations, locale)?.name ?? d.localName,
      priceTry: d.priceTry ? Number(d.priceTry) : null,
      portion: d.portion,
    })),
    announcements: v.announcements.map(toAnnouncementDTO),
  };
}

/** Satıcının mekanı; başkasınınsa 404 (varlığı sızdırılmaz) */
async function ownedVenue(ownerId: string, venueId: string) {
  const venue = await prisma.venue.findFirst({ where: { id: venueId, ownerId } });
  if (!venue) throw notFound('Venue');
  return venue;
}

async function loadVendorVenue(venueId: string, locale: Locale, now: Date) {
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId }, include: vendorInclude(locale) });
  return toVendorVenue(venue, locale, now);
}

export async function listVendorVenues(ownerId: string, locale: Locale, now = new Date()): Promise<VendorVenueDTO[]> {
  const venues = await prisma.venue.findMany({
    where: { ownerId },
    orderBy: { name: 'asc' },
    include: vendorInclude(locale),
  });
  return venues.map((v) => toVendorVenue(v, locale, now));
}

/** GPS ya da haritadan seçilen anlık konum: isLiveLocation = true, lastLocationUpdate = şimdi */
export async function updateLiveLocation(
  ownerId: string,
  venueId: string,
  input: VendorLocationInput,
  locale: Locale,
  now = new Date(),
) {
  const venue = await ownedVenue(ownerId, venueId);
  if (!isStreetVendor(venue)) {
    throw new HttpError(409, 'NOT_STREET_VENDOR', 'Live location is only available for street vendors');
  }
  const distance = haversineMeters({ latitude: venue.latitude, longitude: venue.longitude }, input);
  if (distance > MAX_LIVE_DISTANCE_FROM_BASE_M) {
    throw new HttpError(422, 'TOO_FAR_FROM_BASE', 'Location is too far from the registered spot', {
      distanceMeters: Math.round(distance),
    });
  }
  await prisma.venue.update({
    where: { id: venue.id },
    data: { isLiveLocation: true, liveLatitude: input.latitude, liveLongitude: input.longitude, lastLocationUpdate: now },
  });
  return loadVendorVenue(venue.id, locale, now);
}

/** true/false: elle Açık/Kapalı (12 saat geçerli) · null: çalışma saatlerine dön */
export async function setOpenOverride(ownerId: string, venueId: string, isOpen: boolean | null, locale: Locale, now = new Date()) {
  const venue = await ownedVenue(ownerId, venueId);
  await prisma.venue.update({
    where: { id: venue.id },
    data: { openOverride: isOpen, openOverrideAt: isOpen === null ? null : now },
  });
  return loadVendorVenue(venue.id, locale, now);
}

/** Duyuru Super Admin onayına düşer (PENDING) */
export async function createAnnouncement(ownerId: string, venueId: string, input: VendorAnnouncementInput) {
  const venue = await ownedVenue(ownerId, venueId);
  assertAcceptableContent(input.title, input.content);
  const pending = await prisma.vendorAnnouncement.count({ where: { venueId: venue.id, status: 'PENDING' } });
  if (pending >= MAX_PENDING_ANNOUNCEMENTS) {
    throw new HttpError(429, 'TOO_MANY_PENDING', 'Wait for your pending announcements to be reviewed');
  }
  const created = await prisma.vendorAnnouncement.create({
    data: { venueId: venue.id, title: input.title, content: input.content, type: input.type ?? 'ANNOUNCEMENT' },
  });
  return toAnnouncementDTO(created);
}

/** Yalnızca kendi mekanının yemeği: fiyat ve porsiyon */
export async function updateDish(ownerId: string, dishId: string, input: VendorDishInput) {
  const dish = await prisma.dish.findFirst({ where: { id: dishId, venue: { ownerId } }, select: { id: true } });
  if (!dish) throw notFound('Dish');
  if (input.portion) assertAcceptableContent(input.portion);
  const updated = await prisma.dish.update({
    where: { id: dish.id },
    data: { priceTry: input.priceTry, portion: input.portion || null },
  });
  return { id: updated.id, priceTry: updated.priceTry ? Number(updated.priceTry) : null, portion: updated.portion };
}
