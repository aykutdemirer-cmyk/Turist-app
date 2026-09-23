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
// Google ile giriş — backend hazır, mobil taraf development build gerektirdiği için henüz bağlı değil.
// İstemci Google'dan aldığı ID token'ı gönderir; imza Google'ın JWKS'i ile doğrulanır.
// ─────────────────────────────────────────────

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function loginWithGoogle(input: GoogleLoginInput): Promise<AuthResponseDTO> {
  const audience = env.GOOGLE_CLIENT_ID.split(',').map((s) => s.trim()).filter(Boolean);
  if (audience.length === 0) {
    throw new HttpError(501, 'GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured on this server');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(input.idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience,
    }));
  } catch {
    throw unauthorized('Invalid Google token');
  }

  const sub = payload.sub;
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
  if (!sub || !email || payload.email_verified !== true) throw unauthorized('Google account email is not verified');

  const profile = {
    fullName: typeof payload.name === 'string' ? payload.name : undefined,
    avatarUrl: typeof payload.picture === 'string' ? payload.picture : undefined,
    lastLoginAt: new Date(),
  };

  const existing = await prisma.user.findFirst({
    where: { OR: [{ authProvider: 'google', authProviderId: sub }, { email }] },
  });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        // E-posta ile açılmış hesaba Google bağlanır; şifre korunur
        data: { lastLoginAt: profile.lastLoginAt, avatarUrl: existing.avatarUrl ?? profile.avatarUrl },
      })
    : await prisma.user.create({ data: { ...profile, email, authProvider: 'google', authProviderId: sub } });
  return session(user);
}
