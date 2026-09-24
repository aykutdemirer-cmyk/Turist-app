import { Prisma } from '@prisma/client';
import type {
  CommentDTO,
  CreateCommentInput,
  CreatePostInput,
  FeedQuery,
  FeedResponseDTO,
  LikeResultDTO,
  PostDetailDTO,
  PostDTO,
  PublicAuthorDTO,
} from '@localbite/shared';
import { prisma } from '../db';
import { publicName, unauthorized } from '../lib/auth';
import { assertAcceptableContent } from '../lib/contentFilter';
import { notFound } from '../lib/errors';
import { blockedIdsFor } from './moderation.service';

const MAX_DETAIL_COMMENTS = 200;

const authorSelect = { select: { id: true, fullName: true, role: true } } as const;

const postInclude = (viewerId: string | null) =>
  ({
    user: authorSelect,
    venue: { select: { id: true, name: true } },
    // Yalnızca izleyicinin kendi beğenisi (varsa tek satır)
    likes: { where: { userId: viewerId ?? '' }, select: { userId: true }, take: 1 },
  }) satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;

const toAuthor = (u: { id: string; fullName: string | null; role: PublicAuthorDTO['role'] }): PublicAuthorDTO => ({
  id: u.id,
  name: publicName(u.fullName),
  role: u.role,
});

function toPost(p: PostRow): PostDTO {
  return {
    id: p.id,
    title: p.title,
    content: p.content,
    author: toAuthor(p.user),
    venue: p.venue,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    likedByMe: p.likes.length > 0,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Token geçerli olsa da hesap silinmiş olabilir */
async function assertMember(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { authProvider: true } });
  if (!user?.authProvider) throw unauthorized('Account not found');
}

/** En yeniden eskiye; id imleciyle sayfalama (eşit createdAt'ta id kırar) */
export async function listFeed(query: FeedQuery, viewerId: string | null): Promise<FeedResponseDTO> {
  const blocked = await blockedIdsFor(viewerId);
  const rows = await prisma.post.findMany({
    // Kaldırılan gönderiler ve izleyicinin engellediği üyeler görünmez
    where: { removedAt: null, ...(blocked.length && { userId: { notIn: blocked } }) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    include: postInclude(viewerId),
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return { items: page.map(toPost), nextCursor: hasMore ? page.at(-1)!.id : null };
}

export async function getPost(postId: string, viewerId: string | null): Promise<PostDetailDTO> {
  const blocked = await blockedIdsFor(viewerId);
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      ...postInclude(viewerId),
      comments: {
        where: { removedAt: null, ...(blocked.length && { userId: { notIn: blocked } }) },
        orderBy: { createdAt: 'asc' },
        take: MAX_DETAIL_COMMENTS,
        include: { user: authorSelect },
      },
    },
  });
  if (!post || post.removedAt || blocked.includes(post.userId)) throw notFound('Post');
  return { ...toPost(post), comments: post.comments.map(toComment) };
}

export async function createPost(userId: string, input: CreatePostInput): Promise<PostDTO> {
  await assertMember(userId);
  assertAcceptableContent(input.title, input.content);
  if (input.venueId) {
    const venue = await prisma.venue.findFirst({ where: { id: input.venueId, status: 'APPROVED' }, select: { id: true } });
    if (!venue) throw notFound('Venue');
  }
  const post = await prisma.post.create({
    data: { userId, title: input.title, content: input.content, venueId: input.venueId },
    include: postInclude(userId),
  });
  return toPost(post);
}

function toComment(c: Prisma.CommentGetPayload<{ include: { user: typeof authorSelect } }>): CommentDTO {
  return { id: c.id, content: c.content, author: toAuthor(c.user), createdAt: c.createdAt.toISOString() };
}

export async function addComment(postId: string, userId: string, input: CreateCommentInput): Promise<CommentDTO> {
  await assertMember(userId);
  assertAcceptableContent(input.content);
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { removedAt: true } });
  if (!post || post.removedAt) throw notFound('Post');
  try {
    const [comment] = await prisma.$transaction([
      prisma.comment.create({ data: { postId, userId, content: input.content }, include: { user: authorSelect } }),
      prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
    ]);
    return toComment(comment);
  } catch (err) {
    // P2003: gönderi yok (FK), P2025: güncellenecek gönderi yok
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2003' || err.code === 'P2025')) {
      throw notFound('Post');
    }
    throw err;
  }
}

/** "Katılıyorum": idempotent aç/kapa. Sayaç yalnızca gerçekten satır eklenip silinince değişir. */
export async function setLike(postId: string, userId: string, liked: boolean): Promise<LikeResultDTO> {
  await assertMember(userId);
  const exists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!exists) throw notFound('Post');

  const likeCount = await prisma.$transaction(async (tx) => {
    const changed = liked
      ? (await tx.postLike.createMany({ data: [{ postId, userId }], skipDuplicates: true })).count
      : (await tx.postLike.deleteMany({ where: { postId, userId } })).count;
    const post = await tx.post.update({
      where: { id: postId },
      data: changed ? { likeCount: { increment: liked ? 1 : -1 } } : {},
      select: { likeCount: true },
    });
    return post.likeCount;
  });
  return { liked, likeCount };
}
