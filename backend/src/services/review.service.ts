import type { ReviewDTO, ReviewInput } from '@localbite/shared';
import { prisma } from '../db';
import { publicName, unauthorized } from '../lib/auth';
import { notFound } from '../lib/errors';

/**
 * Üyenin mekan yorumu. Aynı mekana ikinci kez yazınca eskisi güncellenir (@@unique venueId+userId);
 * metin, yazıldığı dilde tek çeviri satırı olarak saklanır.
 */
export async function upsertReview(venueId: string, userId: string, input: ReviewInput, now = new Date()): Promise<ReviewDTO> {
  const [venue, user] = await Promise.all([
    prisma.venue.findFirst({ where: { id: venueId, status: 'APPROVED' }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, authProvider: true } }),
  ]);
  if (!venue) throw notFound('Venue');
  if (!user?.authProvider) throw unauthorized('Account not found');

  const authorName = publicName(user.fullName);
  const review = await prisma.$transaction(async (tx) => {
    const saved = await tx.review.upsert({
      where: { venueId_userId: { venueId, userId } },
      create: {
        venueId,
        userId,
        authorName,
        rating: input.rating,
        source: 'COMMUNITY',
        originalLocale: input.locale,
        publishedAt: now,
      },
      update: { authorName, rating: input.rating, originalLocale: input.locale, publishedAt: now },
    });
    // Düzenlenen yorumun eski çevirileri artık geçersiz
    await tx.reviewTranslation.deleteMany({ where: { reviewId: saved.id } });
    await tx.reviewTranslation.create({ data: { reviewId: saved.id, locale: input.locale, text: input.text } });
    return saved;
  });

  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    source: review.source,
    sourceUrl: review.sourceUrl,
    publishedAt: review.publishedAt.toISOString(),
    text: input.text,
    originalLocale: review.originalLocale,
    isTranslated: false,
    userId: review.userId,
  };
}
