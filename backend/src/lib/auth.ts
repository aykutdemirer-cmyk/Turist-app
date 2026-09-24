import type { UserRole } from '@localbite/shared';
import type { FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from './errors';

const ISSUER = 'localbite';
const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function signSession(userId: string, now = new Date()) {
  const expiresAt = new Date(now.getTime() + env.JWT_TTL_DAYS * 86_400_000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);
  return { token, expiresAt };
}

export const unauthorized = (message = 'Sign in to continue') => new HttpError(401, 'UNAUTHORIZED', message);

/**
 * Authorization: Bearer <jwt> başlığından üye kimliği.
 * Başlık yoksa null (misafir); başlık var ama geçersizse 401 — istemci oturumu temizlesin diye.
 */
export async function optionalUserId(req: FastifyRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized('Malformed Authorization header');
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, algorithms: ['HS256'] });
    if (!payload.sub) throw unauthorized('Invalid session');
    return payload.sub;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof joseErrors.JWTExpired) throw unauthorized('Session expired');
    throw unauthorized('Invalid session');
  }
}

export async function requireUserId(req: FastifyRequest): Promise<string> {
  const id = await optionalUserId(req);
  if (!id) throw unauthorized();
  return id;
}

/** Herkese açık görünen ad: "Elif Kaya" → "Elif K." */
export function publicName(fullName: string | null | undefined, fallback = 'Guest'): string {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(' ')} ${parts.at(-1)!.charAt(0).toLocaleUpperCase('tr')}.`;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** roleGuard'ın doğruladığı üye; yalnızca korunan kapsamlarda dolu */
    actorId: string;
  }
}

/**
 * Kapsam (plugin) düzeyinde rol koruması: `app.addHook('onRequest', roleGuard('SUPER_ADMIN'))`.
 * Rol her istekte veritabanından okunur; token'daki eski bilgiye güvenilmez (yetki geri alınınca hemen düşer).
 */
export function roleGuard(role: UserRole): onRequestAsyncHookHandler {
  return async (req) => {
    const id = await requireUserId(req);
    const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!user) throw unauthorized('Account not found');
    if (user.role !== role) throw new HttpError(403, 'FORBIDDEN', `${role} role required`);
    req.actorId = id;
  };
}
