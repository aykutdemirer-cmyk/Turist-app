import { Prisma } from '@prisma/client';
import {
  getLocalClock,
  haversineMeters,
  LOCATION_REQUIRED_REPORTS,
  type LatLng,
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
