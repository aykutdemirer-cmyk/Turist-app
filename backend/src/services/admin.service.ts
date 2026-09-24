import type { Prisma } from '@prisma/client';
import type { AdminAnnouncementDTO, AdminVenueDTO, AdminVenuesQuery, AnnouncementStatus, Locale } from '@localbite/shared';
import { prisma } from '../db';
import { publicName } from '../lib/auth';
import { HttpError, notFound } from '../lib/errors';
import { localesFor, pickTranslation } from '../lib/locale';
import { toAnnouncementDTO } from './vendor.service';

// ─────────────────────────────────────────────
// Mekanlar: onay, sponsorluk, canlı konum denetimi
// ─────────────────────────────────────────────

const adminVenueInclude = (locale: Locale) =>
  ({
    translations: { where: { locale: { in: localesFor(locale) } } },
    dishes: {
      where: { isMustTry: true },
      orderBy: { sortOrder: 'asc' },
      take: 3,
      include: { translations: { where: { locale: { in: localesFor(locale) } } } },
    },
    owner: { select: { id: true, fullName: true, email: true } },
  }) satisfies Prisma.VenueInclude;

type AdminVenue = Prisma.VenueGetPayload<{ include: ReturnType<typeof adminVenueInclude> }>;

function toAdminVenue(v: AdminVenue, locale: Locale): AdminVenueDTO {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    type: v.type,
    locationType: v.locationType,
    status: v.status,
    isPromoted: v.isPromoted,
    neighborhood: v.neighborhood,
    district: v.district,
    locationNote: v.locationNote,
    tagline: pickTranslation(v.translations, locale)?.tagline ?? null,
    mustTry: v.dishes.map((d) => pickTranslation(d.translations, locale)?.name ?? d.localName),
    baseLocation: { latitude: v.latitude, longitude: v.longitude },
    liveLocation:
      v.isLiveLocation && v.liveLatitude != null && v.liveLongitude != null && v.lastLocationUpdate
        ? { latitude: v.liveLatitude, longitude: v.liveLongitude, updatedAt: v.lastLocationUpdate.toISOString() }
        : null,
    owner: v.owner && { id: v.owner.id, name: publicName(v.owner.fullName), email: v.owner.email },
    createdAt: v.createdAt.toISOString(),
  };
}

export async function listAdminVenues(query: AdminVenuesQuery, locale: Locale): Promise<AdminVenueDTO[]> {
  const where: Prisma.VenueWhereInput = {
    status: query.status,
    isPromoted: query.promoted,
    ...(query.live && { isLiveLocation: true, locationType: 'DYNAMIC_STREET' }),
    ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
  };
  const orderBy: Prisma.VenueOrderByWithRelationInput[] = query.live
    ? [{ lastLocationUpdate: 'desc' }]
    : query.status === 'PENDING_APPROVAL'
      ? [{ createdAt: 'asc' }]
      : [{ isPromoted: 'desc' }, { name: 'asc' }];

  const venues = await prisma.venue.findMany({ where, orderBy, take: query.limit, include: adminVenueInclude(locale) });
  return venues.map((v) => toAdminVenue(v, locale));
}

async function loadAdminVenue(id: string, locale: Locale) {
  return toAdminVenue(await prisma.venue.findUniqueOrThrow({ where: { id }, include: adminVenueInclude(locale) }), locale);
}

/** Başvuru kararı: yalnızca onay bekleyen mekanlar */
export async function reviewVenue(id: string, decision: 'approve' | 'reject', locale: Locale) {
  const { count } = await prisma.venue.updateMany({
    where: { id, status: 'PENDING_APPROVAL' },
    data: { status: decision === 'approve' ? 'ACTIVE' : 'REJECTED' },
  });
  if (!count) {
    const exists = await prisma.venue.count({ where: { id } });
    throw exists ? new HttpError(409, 'ALREADY_REVIEWED', 'Venue is not pending approval') : notFound('Venue');
  }
  return loadAdminVenue(id, locale);
}

/** "Seçilmiş Lezzet" / sponsorlu anahtarı; yalnızca yayındaki mekanlar */
export async function setPromoted(id: string, isPromoted: boolean, locale: Locale) {
  const venue = await prisma.venue.findUnique({ where: { id }, select: { status: true } });
  if (!venue) throw notFound('Venue');
  if (venue.status !== 'ACTIVE') throw new HttpError(409, 'VENUE_NOT_ACTIVE', 'Only active venues can be promoted');
  await prisma.venue.update({ where: { id }, data: { isPromoted } });
  return loadAdminVenue(id, locale);
}

/**
 * Canlı konum denetimi:
 *  pin   — satıcının son konumunu kalıcı (kayıtlı) konum yap, canlı işareti kalkar
 *  reset — canlı konumu sil, kayıtlı konuma dön (hatalı/şüpheli konum)
 */
export async function moderateLiveLocation(id: string, action: 'pin' | 'reset', locale: Locale) {
  const venue = await prisma.venue.findUnique({ where: { id } });
  if (!venue) throw notFound('Venue');
  if (venue.liveLatitude == null || venue.liveLongitude == null) {
    throw new HttpError(409, 'NO_LIVE_LOCATION', 'Venue has no live location');
  }
  const clear = { isLiveLocation: false, liveLatitude: null, liveLongitude: null, lastLocationUpdate: null };
  await prisma.venue.update({
    where: { id },
    data: action === 'pin' ? { ...clear, latitude: venue.liveLatitude, longitude: venue.liveLongitude } : clear,
  });
  return loadAdminVenue(id, locale);
}

// ─────────────────────────────────────────────
// Satıcı duyuruları
// ─────────────────────────────────────────────

const announcementInclude = { venue: { select: { id: true, name: true, slug: true } } } as const;

export async function listAnnouncements(status: AnnouncementStatus): Promise<AdminAnnouncementDTO[]> {
  const rows = await prisma.vendorAnnouncement.findMany({
    where: { status },
    orderBy: { createdAt: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    include: announcementInclude,
  });
  return rows.map((a) => ({ ...toAnnouncementDTO(a), venue: a.venue }));
}

/** Onaylanan duyuru bu andan itibaren yayında (ANNOUNCEMENT_TTL_MS) */
export async function reviewAnnouncement(id: string, decision: 'approve' | 'reject'): Promise<AdminAnnouncementDTO> {
  const { count } = await prisma.vendorAnnouncement.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: decision === 'approve' ? 'APPROVED' : 'REJECTED', reviewedAt: new Date() },
  });
  if (!count) {
    const exists = await prisma.vendorAnnouncement.count({ where: { id } });
    throw exists ? new HttpError(409, 'ALREADY_REVIEWED', 'Announcement is not pending') : notFound('Announcement');
  }
  const a = await prisma.vendorAnnouncement.findUniqueOrThrow({ where: { id }, include: announcementInclude });
  return { ...toAnnouncementDTO(a), venue: a.venue };
}
