import { Prisma, type ReportableContent } from '@prisma/client';
import type { AdminReportDTO, BlockedUserDTO, ModerationStatus, ReportContentInput } from '@localbite/shared';
import { prisma } from '../db';
import { publicName, unauthorized } from '../lib/auth';
import { HttpError, notFound } from '../lib/errors';

// ─────────────────────────────────────────────
// Engelleme
// ─────────────────────────────────────────────

/** İzleyicinin engellediği üyeler (listelerde filtrelenir). Misafir için boş. */
export async function blockedIdsFor(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];
  const rows = await prisma.blockedUser.findMany({ where: { blockerId: viewerId }, select: { blockedId: true } });
  return rows.map((r) => r.blockedId);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<BlockedUserDTO> {
  if (blockerId === blockedId) throw new HttpError(400, 'CANNOT_BLOCK_SELF', 'You cannot block yourself');
  const target = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true, fullName: true } });
  if (!target) throw notFound('User');
  const row = await prisma.blockedUser.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
  return { id: target.id, name: publicName(target.fullName), blockedAt: row.createdAt.toISOString() };
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
}

export async function listBlocked(blockerId: string): Promise<BlockedUserDTO[]> {
  const rows = await prisma.blockedUser.findMany({
    where: { blockerId },
    orderBy: { createdAt: 'desc' },
    include: { blocked: { select: { id: true, fullName: true } } },
  });
  return rows.map((r) => ({ id: r.blocked.id, name: publicName(r.blocked.fullName), blockedAt: r.createdAt.toISOString() }));
}

// ─────────────────────────────────────────────
// Şikayet
// ─────────────────────────────────────────────

/** İçeriğin sahibi ve metni; yoksa ya da kaldırılmışsa null */
async function loadContent(type: ReportableContent, id: string) {
  if (type === 'POST') {
    const p = await prisma.post.findUnique({ where: { id }, include: { user: { select: { fullName: true } } } });
    return p && { authorId: p.userId, authorName: publicName(p.user.fullName), text: `${p.title}\n${p.content}`, removedAt: p.removedAt };
  }
  if (type === 'COMMENT') {
    const c = await prisma.comment.findUnique({ where: { id }, include: { user: { select: { fullName: true } } } });
    return c && { authorId: c.userId, authorName: publicName(c.user.fullName), text: c.content, removedAt: c.removedAt };
  }
  const r = await prisma.review.findUnique({ where: { id }, include: { translations: { take: 1 } } });
  return r && { authorId: r.userId, authorName: r.authorName, text: r.translations[0]?.text ?? '', removedAt: r.removedAt };
}

/** Aynı içerik aynı kişiden ikinci kez gelirse sessizce kabul edilir (idempotent) */
export async function reportContent(reporterId: string, input: ReportContentInput): Promise<{ id: string }> {
  const reporter = await prisma.user.findUnique({ where: { id: reporterId }, select: { authProvider: true } });
  if (!reporter?.authProvider) throw unauthorized('Account not found');

  const content = await loadContent(input.contentType, input.contentId);
  if (!content || content.removedAt) throw notFound('Content');
  if (content.authorId === reporterId) throw new HttpError(400, 'CANNOT_REPORT_OWN', 'You cannot report your own content');

  try {
    const report = await prisma.contentReport.create({
      data: {
        reporterId,
        contentType: input.contentType,
        contentId: input.contentId,
        reason: input.reason,
        note: input.note,
      },
      select: { id: true },
    });
    return report;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.contentReport.findUniqueOrThrow({
        where: {
          reporterId_contentType_contentId: {
            reporterId,
            contentType: input.contentType,
            contentId: input.contentId,
          },
        },
        select: { id: true },
      });
      return existing;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────
// Yönetici moderasyonu
// ─────────────────────────────────────────────

/** Şikayetler içerik başına gruplanır: aynı gönderiye gelen 10 şikayet tek satır olur */
export async function listReports(status: ModerationStatus, limit: number): Promise<AdminReportDTO[]> {
  const rows = await prisma.contentReport.findMany({
    where: { status },
    orderBy: { createdAt: 'asc' },
    take: limit * 10,
  });

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.contentType}:${r.contentId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const result: AdminReportDTO[] = [];
  for (const reports of [...groups.values()].slice(0, limit)) {
    const first = reports[0]!;
    const content = await loadContent(first.contentType, first.contentId);
    const reasons: AdminReportDTO['reasons'] = {};
    for (const r of reports) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    result.push({
      id: first.id,
      contentType: first.contentType,
      contentId: first.contentId,
      status: first.status,
      reasons,
      reportCount: reports.length,
      notes: reports.flatMap((r) => (r.note ? [r.note] : [])),
      firstReportedAt: first.createdAt.toISOString(),
      content: content && {
        text: content.text,
        authorId: content.authorId,
        authorName: content.authorName,
        removed: content.removedAt !== null,
      },
    });
  }
  return result;
}

/** İçeriği yayından kaldırır (yumuşak silme) ve o içeriğe ait tüm bekleyen şikayetleri kapatır */
export async function removeReportedContent(reportId: string, adminId: string) {
  const report = await prisma.contentReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound('Report');
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (report.contentType === 'POST') {
      await tx.post.updateMany({ where: { id: report.contentId, removedAt: null }, data: { removedAt: now } });
    } else if (report.contentType === 'COMMENT') {
      const { count } = await tx.comment.updateMany({
        where: { id: report.contentId, removedAt: null },
        data: { removedAt: now },
      });
      if (count) {
        const comment = await tx.comment.findUniqueOrThrow({ where: { id: report.contentId }, select: { postId: true } });
        await tx.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } });
      }
    } else {
      await tx.review.updateMany({ where: { id: report.contentId, removedAt: null }, data: { removedAt: now } });
    }
    await tx.contentReport.updateMany({
      where: { contentType: report.contentType, contentId: report.contentId, status: 'PENDING' },
      data: { status: 'REMOVED', resolvedAt: now, resolvedById: adminId },
    });
  });
}

export async function dismissReport(reportId: string, adminId: string) {
  const report = await prisma.contentReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound('Report');
  await prisma.contentReport.updateMany({
    where: { contentType: report.contentType, contentId: report.contentId, status: 'PENDING' },
    data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedById: adminId },
  });
}
