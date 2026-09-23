import type { SuggestVenueInput } from '@localbite/shared';
import { prisma } from '../db';
import { uniqueSlug } from '../lib/slug';
import { findOrCreateUserByDevice } from './report.service';

/** Kullanıcı önerisi: moderasyon onaylayana kadar haritada görünmez (status = PENDING). */
export async function suggestVenue(deviceId: string, input: SuggestVenueInput) {
  const user = await findOrCreateUserByDevice(deviceId);
  const hasText = input.tagline !== undefined || input.description !== undefined;

  const venue = await prisma.venue.create({
    data: {
      slug: uniqueSlug(input.name),
      name: input.name,
      type: input.type,
      isMobile: input.isMobile,
      priceLevel: input.priceLevel,
      latitude: input.latitude,
      longitude: input.longitude,
      locationNote: input.locationNote,
      neighborhood: input.neighborhood,
      district: input.district,
      localTips: input.localTips,
      status: 'PENDING',
      submittedById: user.id,
      translations: hasText
        ? {
            create: {
              locale: input.locale,
              tagline: input.tagline ?? input.name,
              description: input.description,
            },
          }
        : undefined,
      dishes: {
        create: input.mustTry.map((d, i) => ({
          localName: d.localName,
          sortOrder: i + 1,
          translations:
            d.translatedName || d.description
              ? { create: { locale: input.locale, name: d.translatedName ?? d.localName, description: d.description } }
              : undefined,
        })),
      },
      schedules: { create: input.schedules },
    },
    select: { id: true, slug: true, status: true, createdAt: true },
  });

  return venue;
}
