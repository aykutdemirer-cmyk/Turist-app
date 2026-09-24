import type { DeletionRequestDTO } from '@localbite/shared';
import { prisma } from '../db';
import { notFound } from '../lib/errors';
import { deleteAccount } from './auth.service';

/**
 * Web formundan gelen silme talebi. Talep, e-posta sahipliği doğrulanmadan işlenmez: yoksa herkes başkasının
 * hesabını sildirebilirdi. Talep her durumda aynı yanıtı döndürür (hesabın var olup olmadığı sızmaz).
 */
export async function createDeletionRequest(email: string, note?: string) {
  // Aynı adresten art arda gelen talepleri tek kayıtta topla
  const open = await prisma.accountDeletionRequest.findFirst({ where: { email, status: 'PENDING' } });
  if (open) return open;
  return prisma.accountDeletionRequest.create({ data: { email, note } });
}

export async function listDeletionRequests(): Promise<DeletionRequestDTO[]> {
  const rows = await prisma.accountDeletionRequest.findMany({ orderBy: { createdAt: 'asc' }, take: 200 });
  const users = await prisma.user.findMany({
    where: { email: { in: rows.map((r) => r.email) } },
    select: { email: true },
  });
  const existing = new Set(users.map((u) => u.email));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
    accountExists: existing.has(r.email),
  }));
}

export async function processDeletionRequest(id: string, action: 'complete' | 'reject') {
  const request = await prisma.accountDeletionRequest.findUnique({ where: { id } });
  if (!request) throw notFound('Deletion request');

  let deleted = false;
  if (action === 'complete') {
    const user = await prisma.user.findUnique({ where: { email: request.email }, select: { id: true } });
    if (user) {
      await deleteAccount(user.id);
      deleted = true;
    }
  }
  await prisma.accountDeletionRequest.update({
    where: { id },
    data: { status: action === 'complete' ? 'COMPLETED' : 'REJECTED', processedAt: new Date() },
  });
  return { status: action === 'complete' ? 'COMPLETED' : 'REJECTED', accountDeleted: deleted };
}
