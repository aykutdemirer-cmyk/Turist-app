import type { DishInput, PlaceHoursInput, VenueClaimInput } from '@localbite/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { assertAcceptableContent } from '../lib/contentFilter';
import { findDishPhoto } from '../lib/dishPhotos';
import { HttpError, notFound } from '../lib/errors';
import { reverseGeocode } from '../lib/nominatim';
import { parseOpeningHours } from '../lib/openingHours';
import { fetchWebsiteInfo } from '../lib/websiteInfo';
import { findLivePlace, isLivePlaceId, type LivePlace } from './live-places.service';

/**
 * Gerçek mekanlar: haritadaki (OSM) yer ilk açıldığında kalıcı mekan kaydına dönüşür; böylece küratörlü
 * mekanlardaki her şey (yorum, puan, menü, duyuru, sahiplenme) gerçek dükkanlarda da çalışır.
 * Bilgiler yalnızca gerçek kaynaklardan gelir: OSM → dükkanın web sitesi (schema.org) → Nominatim adresi.
 * Bulunamayan bilgi uydurulmaz; esnaf ya da topluluk tamamlar.
 */

/** İlk açılışta web sitesi/adres araması en fazla bu kadar beklenir; kalanı arka planda kayda yazılır */
const ENRICH_WAIT_MS = 3_500;

interface Contact {
  address: string | null;
  addressIsApproximate: boolean;
  phone: string | null;
  openingHours: string | null;
  openingHoursSource: 'OSM' | 'WEBSITE' | null;
}

/** OSM'de eksik olan telefon/adres/saat: önce dükkanın kendi sitesi, adres için son çare Nominatim */
async function findContact(place: LivePlace): Promise<Contact> {
  const needsWeb = place.website && (!place.openingHours || !place.phone || !place.address);
  const web = needsWeb ? await fetchWebsiteInfo(place.website!) : null;
  let address = place.address ?? web?.address ?? null;
  let addressIsApproximate = false;
  if (!address) {
    address = await reverseGeocode(place.latitude, place.longitude);
    addressIsApproximate = address !== null;
  }
  const openingHours = place.openingHours ?? web?.openingHours ?? null;
  return {
    address,
    addressIsApproximate,
    phone: place.phone ?? web?.phone ?? null,
    openingHours,
    openingHoursSource: place.openingHours ? 'OSM' : web?.openingHours ? 'WEBSITE' : null,
  };
}

const baseContact = (place: LivePlace): Contact => ({
  address: place.address,
  addressIsApproximate: false,
  phone: place.phone,
  openingHours: place.openingHours,
  openingHoursSource: place.openingHours ? 'OSM' : null,
});

/** Haritadaki yerin mekan kaydı (yoksa oluşturur). Yer bulunamazsa null. */
export async function venueIdForExternal(externalId: string): Promise<string | null> {
  const existing = await prisma.venue.findUnique({ where: { externalId }, select: { id: true } });
  if (existing) return existing.id;

  const place = await findLivePlace(externalId);
  if (!place) return null;

  // Google şartları: Google içeriği (adres/telefon/saat) saklanmaz, detayda canlı gelir
  const isGoogle = place.source === 'GOOGLE';
  const enrichment = isGoogle
    ? Promise.resolve({ address: null, addressIsApproximate: false, phone: null, openingHours: null, openingHoursSource: null } as Contact)
    : findContact(place).catch(() => baseContact(place));
  const early = await Promise.race([enrichment, new Promise<null>((r) => setTimeout(() => r(null), ENRICH_WAIT_MS))]);
  const contact = early ?? baseContact(place);

  let id: string;
  try {
    ({ id } = await prisma.venue.create({
      select: { id: true },
      data: {
        externalId,
        slug: externalId.replace(':', '-'),
        name: place.name,
        type: place.type,
        liveCategory: place.liveCategory,
        foodCategories: place.categories,
        priceLevel: place.priceLevel,
        latitude: place.latitude,
        longitude: place.longitude,
        district: place.district,
        website: isGoogle ? null : place.website,
        status: 'ACTIVE',
        coverImageUrl: isGoogle ? null : (place.photo?.url ?? null),
        coverImageCredit: isGoogle ? null : (place.photo?.attribution ?? null),
        coverIsRepresentative: isGoogle ? false : (place.photo?.representative ?? false),
        ...contact,
      },
    }));
  } catch (err) {
    // Aynı anda iki açılış: diğeri oluşturdu
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return (await prisma.venue.findUnique({ where: { externalId }, select: { id: true } }))?.id ?? null;
    }
    throw err;
  }

  // Yetişmeyen web sitesi/adres bilgisi gelince yalnızca hâlâ boş alanlar doldurulur
  if (!early) {
    void enrichment.then(async (c) => {
      const current = await prisma.venue.findUnique({
        where: { id },
        select: { address: true, phone: true, openingHours: true },
      });
      if (!current) return;
      await prisma.venue.update({
        where: { id },
        data: {
          ...(!current.address && c.address && { address: c.address, addressIsApproximate: c.addressIsApproximate }),
          ...(!current.phone && c.phone && { phone: c.phone }),
          ...(!current.openingHours && c.openingHours && { openingHours: c.openingHours, openingHoursSource: c.openingHoursSource }),
        },
      });
    }).catch(() => undefined);
  }
  return id;
}

/** "osm:n123" ya da mekan kimliği → mekan kimliği */
export async function resolveVenueId(idOrExternal: string): Promise<string> {
  const id = isLivePlaceId(idOrExternal) ? await venueIdForExternal(idOrExternal) : idOrExternal;
  if (!id) throw notFound('Venue');
  return id;
}

// ─────────────────────────────────────────────
// Saatler
// ─────────────────────────────────────────────

const DAY_CODES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

/**
 * Form (Pazartesi→Pazar) → "Mo 10:00-22:00, Sa 18:00-02:00".
 * Kapalı günler yazılmaz ve kurallar "," (ek kural) ile birleşir: ";" ile yazılan sonraki gün kuralı
 * önceki gecenin gece yarısını aşan saatini (Cumartesi 18:00–02:00'nin Pazar 00:00–02:00 kısmı) silerdi.
 */
export function toOsmHours(input: PlaceHoursInput): string {
  const rules = input.days.flatMap((day, i) => (day.closed ? [] : [`${DAY_CODES[i]} ${day.open}-${day.close}`]));
  return rules.length ? rules.join(', ') : 'off';
}

function validHours(input: PlaceHoursInput): string {
  if (input.days.some((d) => !d.closed && d.open === d.close)) {
    throw new HttpError(400, 'INVALID_HOURS', 'Opening and closing time are the same');
  }
  const value = toOsmHours(input);
  if (!parseOpeningHours(value, 'tr')) throw new HttpError(400, 'INVALID_HOURS', 'Invalid opening hours');
  return value;
}

/** Üye, sahiplenilmemiş gerçek mekanın saatini ekler/düzeltir */
export async function saveCommunityHours(idOrExternal: string, _userId: string, input: PlaceHoursInput) {
  const id = await resolveVenueId(idOrExternal);
  const venue = await prisma.venue.findUnique({ where: { id }, select: { externalId: true, ownerId: true } });
  if (!venue) throw notFound('Venue');
  // Küratörlü mekanın programı ve sahiplenilmiş dükkanın saatleri esnaftadır
  if (!venue.externalId) throw new HttpError(400, 'NOT_REAL_PLACE', 'Hours of curated venues are managed by the vendor');
  if (venue.ownerId) throw new HttpError(403, 'VENUE_CLAIMED', 'This venue is managed by its owner');

  const openingHours = validHours(input);
  await prisma.venue.update({ where: { id }, data: { openingHours, openingHoursSource: 'COMMUNITY' } });
  return { venueId: id, openingHours };
}

/** Esnaf kendi mekanının saatini girer */
export async function saveVendorHours(ownerId: string, venueId: string, input: PlaceHoursInput) {
  const venue = await prisma.venue.findFirst({ where: { id: venueId, ownerId }, select: { id: true } });
  if (!venue) throw notFound('Venue');
  const openingHours = validHours(input);
  await prisma.venue.update({ where: { id: venueId }, data: { openingHours, openingHoursSource: 'VENDOR' } });
  return { venueId, openingHours };
}

// ─────────────────────────────────────────────
// Sahiplenme ("Bu mekan benim")
// ─────────────────────────────────────────────

export async function claimVenue(idOrExternal: string, userId: string, input: VenueClaimInput) {
  assertAcceptableContent(input.note);
  const venueId = await resolveVenueId(idOrExternal);
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { ownerId: true } });
  if (!venue) throw notFound('Venue');
  if (venue.ownerId) throw new HttpError(409, 'ALREADY_CLAIMED', 'This venue already has an owner');

  const claim = await prisma.venueClaim.upsert({
    where: { venueId_userId: { venueId, userId } },
    // Reddedilen başvuru yeniden gönderilebilir
    update: { note: input.note ?? null, phone: input.phone ?? null, status: 'PENDING', reviewedAt: null },
    create: { venueId, userId, note: input.note ?? null, phone: input.phone ?? null },
  });
  return { claimId: claim.id, status: claim.status };
}

export async function listPendingClaims() {
  const rows = await prisma.venueClaim.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      venue: { select: { id: true, name: true, slug: true, address: true } },
      user: { select: { id: true, fullName: true, email: true, role: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    venue: c.venue,
    user: { id: c.user.id, name: c.user.fullName ?? '—', email: c.user.email, role: c.user.role },
    note: c.note,
    phone: c.phone,
    createdAt: c.createdAt.toISOString(),
  }));
}

/** Onay: üye mekanın sahibi olur (gerekirse VENDOR rolü alır); aynı mekana bekleyen diğer başvurular reddedilir */
export async function decideClaim(id: string, decision: 'approve' | 'reject') {
  const claim = await prisma.venueClaim.findUnique({ where: { id }, include: { user: { select: { role: true } } } });
  if (!claim || claim.status !== 'PENDING') throw notFound('Claim');
  const now = new Date();
  if (decision === 'reject') {
    await prisma.venueClaim.update({ where: { id }, data: { status: 'REJECTED', reviewedAt: now } });
    return { id, status: 'REJECTED' as const };
  }
  await prisma.$transaction([
    prisma.venue.update({ where: { id: claim.venueId }, data: { ownerId: claim.userId } }),
    ...(claim.user.role === 'USER' || claim.user.role === 'LOCAL_GUIDE'
      ? [prisma.user.update({ where: { id: claim.userId }, data: { role: 'VENDOR' } })]
      : []),
    prisma.venueClaim.update({ where: { id }, data: { status: 'APPROVED', reviewedAt: now } }),
    prisma.venueClaim.updateMany({
      where: { venueId: claim.venueId, status: 'PENDING', id: { not: id } },
      data: { status: 'REJECTED', reviewedAt: now },
    }),
  ]);
  return { id, status: 'APPROVED' as const };
}

// ─────────────────────────────────────────────
// Menü: üye önerisi (onaylı) ve esnafın yemekleri
// ─────────────────────────────────────────────

export async function suggestDish(idOrExternal: string, userId: string, input: DishInput) {
  assertAcceptableContent(input.localName, input.portion ?? undefined);
  const venueId = await resolveVenueId(idOrExternal);
  const suggestion = await prisma.dishSuggestion.create({
    data: { venueId, userId, localName: input.localName, priceTry: input.priceTry ?? null, portion: input.portion ?? null },
  });
  return { suggestionId: suggestion.id, status: suggestion.status };
}

export async function listPendingDishSuggestions() {
  const rows = await prisma.dishSuggestion.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { venue: { select: { id: true, name: true, slug: true } }, user: { select: { fullName: true } } },
  });
  return rows.map((s) => ({
    id: s.id,
    venue: s.venue,
    userName: s.user?.fullName ?? null,
    localName: s.localName,
    priceTry: s.priceTry ? Number(s.priceTry) : null,
    portion: s.portion,
    createdAt: s.createdAt.toISOString(),
  }));
}

/** Menüye yemek ekler; görseli arşivden ya da Wikimedia Commons'tan bulur */
export async function addDish(venueId: string, input: DishInput) {
  const [photo, last] = await Promise.all([
    findDishPhoto(input.localName),
    prisma.dish.findFirst({ where: { venueId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
  ]);
  return prisma.dish.create({
    data: {
      venueId,
      localName: input.localName,
      priceTry: input.priceTry ?? null,
      portion: input.portion ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      isMustTry: true,
      ...photo,
    },
  });
}

export async function decideDishSuggestion(id: string, decision: 'approve' | 'reject') {
  const suggestion = await prisma.dishSuggestion.findUnique({ where: { id } });
  if (!suggestion || suggestion.status !== 'PENDING') throw notFound('Suggestion');
  if (decision === 'approve') {
    await addDish(suggestion.venueId, {
      localName: suggestion.localName,
      priceTry: suggestion.priceTry ? Number(suggestion.priceTry) : null,
      portion: suggestion.portion,
    });
  }
  const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
  await prisma.dishSuggestion.update({ where: { id }, data: { status, reviewedAt: new Date() } });
  return { id, status };
}
