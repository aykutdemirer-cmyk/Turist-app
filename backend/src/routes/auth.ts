import {
  deviceIdSchema,
  googleLoginSchema,
  loginSchema,
  OAUTH_PROVIDERS,
  oauthCallbackQuerySchema,
  oauthExchangeSchema,
  oauthStartQuerySchema,
  registerSchema,
} from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUserId } from '../lib/auth';
import { login, loginWithGoogle, me, register } from '../services/auth.service';
import { authorizeUrl, enabledProviders, exchangeAppCode, handleCallback } from '../services/oauth.service';

// Kayıtta cihaz kimliği opsiyonel: varsa misafir geçmişi yeni hesaba taşınır
const optionalDeviceHeaders = z.looseObject({ 'x-device-id': deviceIdSchema.optional() });

const providerParams = z.object({ provider: z.enum(OAUTH_PROVIDERS) });

// Kaba kuvvet denemelerine karşı sıkı sınır
const authRateLimit = { rateLimit: { max: 10, timeWindow: '10 minutes' } };

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/register',
    { schema: { headers: optionalDeviceHeaders, body: registerSchema }, config: authRateLimit },
    async (req, reply) => reply.code(201).send(await register(req.body, req.headers['x-device-id'])),
  );

  app.post('/auth/login', { schema: { body: loginSchema }, config: authRateLimit }, async (req) => login(req.body));

  app.post('/auth/google', { schema: { body: googleLoginSchema }, config: authRateLimit }, async (req) =>
    loginWithGoogle(req.body),
  );

  app.get('/auth/me', async (req) => ({ user: await me(await requireUserId(req)) }));

  // ─── Tarayıcı tabanlı sosyal giriş (bkz. services/oauth.service.ts) ───

  app.get('/auth/oauth/providers', async () => enabledProviders());

  app.get(
    '/auth/oauth/:provider/start',
    { schema: { params: providerParams, querystring: oauthStartQuerySchema }, config: authRateLimit },
    async (req, reply) => reply.redirect(await authorizeUrl(req.params.provider, req.query.redirect, req.query.deviceId)),
  );

  app.get(
    '/auth/oauth/:provider/callback',
    { schema: { params: providerParams, querystring: oauthCallbackQuerySchema } },
    async (req, reply) => reply.redirect(await handleCallback(req.params.provider, req.query)),
  );

  app.post('/auth/oauth/exchange', { schema: { body: oauthExchangeSchema }, config: authRateLimit }, async (req) =>
    exchangeAppCode(req.body.code),
  );
};
