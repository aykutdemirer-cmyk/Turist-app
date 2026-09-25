import type { PlaceHoursInput } from '@localbite/shared';
import { prisma } from '../db';
import { HttpError } from '../lib/errors';
import { parseOpeningHours } from '../lib/openingHours';

const invalid = (message: string) => new HttpError(400, 'INVALID_HOURS', message);
const isLivePlaceId = (id: string) => /^(osm:[nwr]\d+|google:[\w-]+)$/.test(id);

/**
 * Topluluk saatleri: kaynağında (OSM) saati olmayan ya da yanlış olan dış kaynaklı yerler için
 * giriş yapmış üyelerin girdiği haftalık saatler. OSM sözdizimiyle saklanır, aynı ayrıştırıcıyla yorumlanır.
 */

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

/** Listelenen yerlerin topluluk saatleri (tek sorgu) */
export async function communityHours(placeIds: string[]): Promise<Map<string, string>> {
  if (!placeIds.length) return new Map();
  const rows = await prisma.placeHours.findMany({
    where: { placeId: { in: placeIds } },
    select: { placeId: true, openingHours: true },
  });
  return new Map(rows.map((r) => [r.placeId, r.openingHours]));
}

export async function saveCommunityHours(placeId: string, userId: string, input: PlaceHoursInput) {
  // Kendi mekanlarımızın saatini satıcı panelinden esnaf yönetir
  if (!isLivePlaceId(placeId)) throw invalid('Hours can only be edited for map places');
  if (input.days.some((d) => !d.closed && d.open === d.close)) throw invalid('Opening and closing time are the same');

  const openingHours = toOsmHours(input);
  if (!parseOpeningHours(openingHours, 'tr')) throw invalid('Invalid opening hours');

  await prisma.placeHours.upsert({
    where: { placeId },
    create: { placeId, openingHours, updatedById: userId },
    update: { openingHours, updatedById: userId },
  });
  return { placeId, openingHours };
}
