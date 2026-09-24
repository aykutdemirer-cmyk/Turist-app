import { Prisma, type User } from '@prisma/client';
import type { AuthResponseDTO, AuthUserDTO, GoogleLoginInput, LoginInput, RegisterInput } from '@localbite/shared';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../db';
import { env } from '../env';
import { signSession, unauthorized } from '../lib/auth';
import { HttpError } from '../lib/errors';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../lib/password';

export function toAuthUser(u: User): AuthUserDTO {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    locale: u.locale,
    createdAt: u.createdAt.toISOString(),
    isPremium: !!u.premiumUntil && u.premiumUntil > new Date(),
  };
}

async function session(user: User): Promise<AuthResponseDTO> {
  const { token, expiresAt } = await signSession(user.id);
  return { token, expiresAt: expiresAt.toISOString(), user: toAuthUser(user) };
}

const emailTaken = () => new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

/**
 * E-posta ile kayıt. Bu cihazın misafir kaydı henüz bir üyeye bağlı değilse o satır üyeye yükseltilir;
 * böylece daha önceki teyitler ve öneriler yeni hesapta kalır.
 */
export async function register(input: RegisterInput, deviceId: string | undefined): Promise<AuthResponseDTO> {
  const passwordHash = await hashPassword(input.password);
  const data = {
    email: input.email,
    fullName: input.fullName,
    passwordHash,
    authProvider: 'email',
    lastLoginAt: new Date(),
    termsAcceptedAt: new Date(),
    ...(input.locale && { locale: input.locale }),
  };

  try {
    const guest = deviceId ? await prisma.user.findUnique({ where: { deviceId } }) : null;
    const user =
      guest && !guest.email && !guest.authProvider
        ? await prisma.user.update({ where: { id: guest.id }, data })
        : await prisma.user.create({ data });
    return session(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw emailTaken();
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResponseDTO> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash) {
    await burnPasswordCheck(input.password);
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return session(updated);
}

export async function me(userId: string): Promise<AuthUserDTO> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // Token geçerli ama hesap silinmiş
  if (!user || !user.authProvider) throw unauthorized('Account not found');
  return toAuthUser(user);
}

// ─────────────────────────────────────────────
// Sosyal giriş (Google, GitHub) — ortak hesap eşleştirme
// ─────────────────────────────────────────────

export type OAuthProvider = 'google' | 'github';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  /** Sağlayıcının doğruladığı e-posta (küçük harf) */
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

/**
 * Sağlayıcı kimliğiyle ya da doğrulanmış e-postayla eşleşen üyeyi bulur; yoksa oluşturur.
 * E-posta ile açılmış hesaba sosyal giriş bağlanır (şifre korunur). Cihazın misafir kaydı
 * henüz bir üyeye bağlı değilse yeni hesap o satırın üzerine açılır.
 */
export async function upsertOAuthUser(
  profile: OAuthProfile,
  deviceId?: string,
  termsAccepted = false,
): Promise<User> {
  const now = new Date();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ authProvider: profile.provider, authProviderId: profile.providerId }, { email: profile.email }] },
  });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        lastLoginAt: now,
        fullName: existing.fullName ?? profile.fullName,
        avatarUrl: existing.avatarUrl ?? profile.avatarUrl,
        ...(termsAccepted && !existing.termsAcceptedAt && { termsAcceptedAt: now }),
      },
    });
  }

  // Yeni hesap açmak Kullanım Şartları onayı gerektirir
  if (!termsAccepted) {
    throw new HttpError(403, 'OAUTH_TERMS_REQUIRED', 'Accept the Terms of Use to create an account');
  }
  const data = {
    termsAcceptedAt: now,
    email: profile.email,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    authProvider: profile.provider,
    authProviderId: profile.providerId,
    lastLoginAt: now,
  };
  const guest = deviceId ? await prisma.user.findUnique({ where: { deviceId } }) : null;
  try {
    return guest && !guest.email && !guest.authProvider
      ? await prisma.user.update({ where: { id: guest.id }, data })
      : await prisma.user.create({ data });
  } catch (err) {
    // Aynı anda iki giriş denemesi: ikinci istek diğerinin açtığı hesabı kullanır
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user) return user;
    }
    throw err;
  }
}

export const createSession = session;

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const googleClientIds = () => env.GOOGLE_CLIENT_ID.split(',').map((s) => s.trim()).filter(Boolean);

/** Google ID token'ını imza, yayıncı ve hedef kitleye göre doğrular */
export async function verifyGoogleIdToken(idToken: string): Promise<OAuthProfile> {
  const audience = googleClientIds();
  if (audience.length === 0) {
    throw new HttpError(501, 'GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured on this server');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
    }));
  } catch {
    throw unauthorized('Invalid Google token');
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
  if (!payload.sub || !email || payload.email_verified !== true) {
    throw unauthorized('Google account email is not verified');
  }
  return {
    provider: 'google',
    providerId: payload.sub,
    email,
    fullName: typeof payload.name === 'string' ? payload.name : undefined,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}

/** Yerel Google girişi (development build'de istemcinin aldığı ID token ile) */
export async function loginWithGoogle(input: GoogleLoginInput): Promise<AuthResponseDTO> {
  return session(await upsertOAuthUser(await verifyGoogleIdToken(input.idToken)));
}

// ─────────────────────────────────────────────
// Hesap silme (KVKK/GDPR, App Store 5.1.1(v), Google Play hesap silme politikası)
// ─────────────────────────────────────────────

/**
 * Üyeyi ve kişisel verilerini kalıcı olarak siler:
 *  - yorumları (Review.userId SetNull olduğu için açıkça), gönderileri, yanıtları, beğenileri, teyitleri,
 *    şikayetleri ve engelleme kayıtları (cascade)
 *  - başkalarının gönderilerindeki sayaçlar düzeltilir
 * Oturum token'ları durumsuz JWT'dir; kullanıcı satırı silinince her istekte "Account not found" ile reddedilir.
 * Önerilen mekanlar anonimleşir (submittedById → null); mekan bilgisi kişisel veri değildir.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw unauthorized('Account not found');

  await prisma.$transaction(async (tx) => {
    // Başkalarının gönderilerindeki yanıt/beğeni sayaçları
    const comments = await tx.comment.groupBy({
      by: ['postId'],
      where: { userId, removedAt: null, post: { userId: { not: userId } } },
      _count: { _all: true },
    });
    for (const c of comments) {
      await tx.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: c._count._all } } });
    }
    const likes = await tx.postLike.findMany({ where: { userId, post: { userId: { not: userId } } }, select: { postId: true } });
    if (likes.length) {
      await tx.post.updateMany({ where: { id: { in: likes.map((l) => l.postId) } }, data: { likeCount: { decrement: 1 } } });
    }

    await tx.review.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });
}
