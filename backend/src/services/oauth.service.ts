import { randomBytes } from 'node:crypto';
import type { AuthResponseDTO, OAuthProvidersDTO } from '@localbite/shared';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError } from '../lib/errors';
import {
  createSession,
  googleClientIds,
  upsertOAuthUser,
  verifyGoogleIdToken,
  type OAuthProfile,
  type OAuthProvider,
} from './auth.service';

/**
 * Tarayıcı tabanlı OAuth (authorization code) akışı — Expo Go'da yerel SDK gerektirmez:
 *  1. Uygulama tarayıcıda /auth/oauth/:provider/start?redirect=<uygulama bağlantısı> açar
 *  2. Sağlayıcı /callback'e döner; kod burada gizli anahtarla token'a çevrilir
 *  3. Uygulamaya tek kullanımlık, 60 sn geçerli bir kodla dönülür; uygulama onu /exchange ile oturuma çevirir.
 *     Oturum token'ı tarayıcı geçmişine ve bağlantılara hiç girmez.
 */

const STATE_TTL_S = 10 * 60;
const CODE_TTL_MS = 60_000;
const stateSecret = new TextEncoder().encode(`${env.JWT_SECRET}:oauth-state`);

const apiBase = () => (env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, '');
const callbackUrl = (provider: OAuthProvider) => `${apiBase()}/api/v1/auth/oauth/${provider}/callback`;

export function enabledProviders(): OAuthProvidersDTO {
  return {
    google: googleClientIds().length > 0 && env.GOOGLE_CLIENT_SECRET !== '',
    github: env.GITHUB_CLIENT_ID !== '' && env.GITHUB_CLIENT_SECRET !== '',
  };
}

function assertEnabled(provider: OAuthProvider) {
  if (!enabledProviders()[provider]) {
    throw new HttpError(501, 'OAUTH_DISABLED', `${provider} sign-in is not configured on this server`);
  }
}

/**
 * Dönüş yalnızca izinli uygulama şemalarına (exp://, localbite://) ya da açıkça izin verilen web origin'lerine
 * (yönetici paneli) yapılır: tek kullanımlık kod başka bir siteye sızmasın.
 */
export function assertAppRedirect(redirect: string): URL {
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    throw new HttpError(400, 'INVALID_REDIRECT', 'redirect must be an app URL');
  }
  const schemes = env.OAUTH_APP_SCHEMES.split(',').map((s) => `${s.trim()}:`);
  const webOrigins = env.OAUTH_WEB_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
  if (isWeb ? !webOrigins.includes(url.origin) : !schemes.includes(url.protocol)) {
    throw new HttpError(400, 'INVALID_REDIRECT', 'redirect target is not allowed');
  }
  return url;
}

interface StatePayload {
  provider: OAuthProvider;
  redirect: string;
  deviceId?: string;
  /** Kullanıcı uygulamada şartları onayladı */
  terms?: boolean;
}

async function signState(payload: StatePayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_S}s`)
    .setJti(randomBytes(12).toString('base64url'))
    .sign(stateSecret);
}

async function verifyState(state: string, provider: OAuthProvider): Promise<StatePayload> {
  try {
    const { payload } = await jwtVerify(state, stateSecret, { algorithms: ['HS256'] });
    if (payload.provider !== provider || typeof payload.redirect !== 'string') throw new Error('mismatch');
    return {
      provider,
      redirect: payload.redirect,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : undefined,
      terms: payload.terms === true,
    };
  } catch {
    throw new HttpError(400, 'INVALID_STATE', 'Sign-in link expired or invalid. Please try again.');
  }
}

/** 1. adım: sağlayıcının yetkilendirme sayfasının adresi */
export async function authorizeUrl(
  provider: OAuthProvider,
  redirect: string,
  deviceId?: string,
  terms = false,
): Promise<string> {
  assertEnabled(provider);
  assertAppRedirect(redirect);
  const state = await signState({ provider, redirect, deviceId, terms });

  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: googleClientIds()[0]!,
      redirect_uri: callbackUrl('google'),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  const url = new URL('https://github.com/login/oauth/authorize');
  url.search = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: callbackUrl('github'),
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  }).toString();
  return url.toString();
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok || data.error) throw new HttpError(502, 'OAUTH_EXCHANGE_FAILED', `Token exchange failed: ${data.error ?? res.status}`);
  return data;
}

async function googleProfile(code: string): Promise<OAuthProfile> {
  const token = await postForm<{ id_token?: string }>('https://oauth2.googleapis.com/token', {
    code,
    client_id: googleClientIds()[0]!,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackUrl('google'),
    grant_type: 'authorization_code',
  });
  if (!token.id_token) throw new HttpError(502, 'OAUTH_EXCHANGE_FAILED', 'Google did not return an ID token');
  return verifyGoogleIdToken(token.id_token);
}

async function githubApi<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'LocalBite',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new HttpError(502, 'OAUTH_PROFILE_FAILED', `GitHub API ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function githubProfile(code: string): Promise<OAuthProfile> {
  const token = await postForm<{ access_token?: string }>('https://github.com/login/oauth/access_token', {
    code,
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    redirect_uri: callbackUrl('github'),
  });
  if (!token.access_token) throw new HttpError(502, 'OAUTH_EXCHANGE_FAILED', 'GitHub did not return an access token');

  const [user, emails] = await Promise.all([
    githubApi<{ id: number; login: string; name: string | null; avatar_url: string | null }>('/user', token.access_token),
    githubApi<{ email: string; primary: boolean; verified: boolean }[]>('/user/emails', token.access_token),
  ]);
  // Profil e-postası gizli olabilir; yalnızca GitHub'ın doğruladığı adresle eşleştir
  const email = (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))?.email;
  if (!email) throw new HttpError(403, 'OAUTH_NO_VERIFIED_EMAIL', 'Your GitHub account has no verified email address');

  return {
    provider: 'github',
    providerId: String(user.id),
    email: email.toLowerCase(),
    fullName: user.name ?? user.login,
    avatarUrl: user.avatar_url ?? undefined,
  };
}

// ─────────────────────────────────────────────
// Tek kullanımlık uygulama kodları (tek sunucu için bellek içi; ölçeklenirse Redis'e taşınmalı)
// ─────────────────────────────────────────────

const pendingCodes = new Map<string, { userId: string; expiresAt: number }>();

function issueAppCode(userId: string): string {
  const now = Date.now();
  for (const [code, entry] of pendingCodes) if (entry.expiresAt < now) pendingCodes.delete(code);
  const code = randomBytes(24).toString('base64url');
  pendingCodes.set(code, { userId, expiresAt: now + CODE_TTL_MS });
  return code;
}

/** 2. adım: sağlayıcı dönüşü. Her durumda uygulamaya dönülecek adresi verir (hata da parametre olarak). */
export async function handleCallback(
  provider: OAuthProvider,
  query: { code?: string; state?: string; error?: string },
): Promise<string> {
  if (!query.state) throw new HttpError(400, 'INVALID_STATE', 'Missing state');
  const state = await verifyState(query.state, provider);
  const back = new URL(state.redirect);

  try {
    if (query.error || !query.code) {
      back.searchParams.set('error', query.error === 'access_denied' ? 'cancelled' : 'OAUTH_FAILED');
      return back.toString();
    }
    const profile = provider === 'google' ? await googleProfile(query.code) : await githubProfile(query.code);
    const user = await upsertOAuthUser(profile, state.deviceId, state.terms);
    back.searchParams.set('code', issueAppCode(user.id));
  } catch (err) {
    back.searchParams.set('error', err instanceof HttpError ? err.code : 'OAUTH_FAILED');
  }
  return back.toString();
}

/** 3. adım: uygulama tek kullanımlık kodu oturuma çevirir */
export async function exchangeAppCode(code: string): Promise<AuthResponseDTO> {
  const entry = pendingCodes.get(code);
  pendingCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new HttpError(401, 'INVALID_CODE', 'Sign-in code expired or already used');
  }
  const user = await prisma.user.findUnique({ where: { id: entry.userId } });
  if (!user) throw new HttpError(401, 'INVALID_CODE', 'Account not found');
  return createSession(user);
}
