import { Prisma } from '@prisma/client';
import {
  boundingBox,
  getLocalClock,
  haversineMeters,
  LOCATION_REQUIRED_REPORTS,
  type LatLng,
  type RecentConfirmationDTO,
  type RecentConfirmationsQuery,
  type ReportInput,
  type ReportResultDTO,
} from '@localbite/shared';
import { prisma } from '../db';
import { HttpError, notFound } from '../lib/errors';
import { spottedTodayCounts } from './venue.service';

/** "Bugün burada gördüm" / "Yoktu" diyen kişi mekana en fazla bu kadar uzak olabilir. */
export const MAX_REPORT_DISTANCE_M = 500;

export async function findOrCreateUserByDevice(deviceId: string) {
  return prisma.user.upsert({ where: { deviceId }, create: { deviceId }, update: {} });
}

/** Yakındaki son "Bugün burada gördüm" teyitleri, en yeniden eskiye. Raporlayan bilgisi dönmez. */
export async function recentConfirmations(
  query: RecentConfirmationsQuery,
  now = new Date(),
): Promise<RecentConfirmationDTO[]> {
  const origin: LatLng = { latitude: query.lat, longitude: query.lng };
  // Seyyarların günlük köşesi varsayılan konumdan uzak olabilir; ön filtreyi genişlet
  const box = boundingBox(origin, query.radius + 1_500);

  const rows = await prisma.spotReport.findMany({
    where: {
      type: 'SPOTTED_TODAY',
      createdAt: { gte: new Date(now.getTime() - query.hours * 3_600_000) },
      venue: {
        status: 'APPROVED',
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: query.limit * 2,
    select: {
      id: true,
      createdAt: true,
      venue: { select: { id: true, name: true, type: true, isMobile: true, latitude: true, longitude: true } },
    },
  });

  return rows
    .map((r) => {
      // Mesafe mekana göre: raporlayan 500 m'ye kadar uzaktan teyit verebilir, onun konumu yanıltır
      const at: LatLng = { latitude: r.venue.latitude, longitude: r.venue.longitude };
      return {
        id: r.id,
        venueId: r.venue.id,
        venueName: r.venue.name,
        venueType: r.venue.type,
        isMobile: r.venue.isMobile,
        createdAt: r.createdAt.toISOString(),
        distanceMeters: Math.round(haversineMeters(origin, at)),
      };
    })
    .filter((c) => c.distanceMeters <= query.radius)
    .slice(0, query.limit);
}

export async function submitReport(
  venueId: string,
  deviceId: string,
  input: ReportInput,
  now = new Date(),
): Promise<ReportResultDTO> {
  const venue = await prisma.venue.findFirst({
    where: { id: venueId, status: 'APPROVED' },
    include: { schedules: true },
  });
  if (!venue) throw notFound('Venue');

  if (LOCATION_REQUIRED_REPORTS.includes(input.type)) {
    const reporter: LatLng = { latitude: input.latitude!, longitude: input.longitude! };
    // Seyyar, programındaki köşelerden herhangi birinde olabilir.
    const candidates: LatLng[] = [
      { latitude: venue.latitude, longitude: venue.longitude },
      ...venue.schedules.flatMap((s) =>
        s.latitude != null && s.longitude != null ? [{ latitude: s.latitude, longitude: s.longitude }] : [],
      ),
    ];
    const distance = Math.min(...candidates.map((c) => haversineMeters(reporter, c)));
    if (distance > MAX_REPORT_DISTANCE_M) {
      throw new HttpError(422, 'TOO_FAR', `You need to be within ${MAX_REPORT_DISTANCE_M} m of the spot to report it`, {
        distanceMeters: Math.round(distance),
      });
    }
  }

  const user = await findOrCreateUserByDevice(deviceId);
  const { dayKey } = getLocalClock(now);

  const counterUpdate: Prisma.VenueUpdateInput =
    input.type === 'SPOTTED_TODAY'
      ? { lastSpottedAt: now, spottedCount: { increment: 1 } }
      : input.type === 'UPVOTE'
        ? { upvoteCount: { increment: 1 } }
        : {};

  try {
    // Aynı transaction: benzersizlik ihlalinde sayaçlar da artmaz.
    const [report, updated] = await prisma.$transaction([
      prisma.spotReport.create({
        data: {
          venueId,
          userId: user.id,
          type: input.type,
          dayKey,
          latitude: input.latitude,
          longitude: input.longitude,
          note: input.note,
          createdAt: now,
        },
      }),
      prisma.venue.update({
        where: { id: venueId },
        data: counterUpdate,
        select: { lastSpottedAt: true, spottedCount: true, upvoteCount: true },
      }),
    ]);

    const spottedToday = await spottedTodayCounts([venueId], now);
    return {
      reportId: report.id,
      type: report.type,
      dayKey,
      venue: {
        ...updated,
        lastSpottedAt: updated.lastSpottedAt?.toISOString() ?? null,
        spottedTodayCount: spottedToday.get(venueId) ?? 0,
      },
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'ALREADY_REPORTED', 'You already sent this report for this spot today', { dayKey });
    }
    throw err;
  }
}
