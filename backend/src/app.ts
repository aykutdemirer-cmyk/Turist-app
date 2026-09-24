import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { prisma } from './db';
import { HttpError } from './lib/errors';
import { authRoutes } from './routes/auth';
import { communityRoutes } from './routes/community';
import { mapRoutes } from './routes/map';
import { mediaRoutes } from './routes/media';
import { monetizationRoutes } from './routes/monetization';
import { adminRoutes } from './routes/admin';
import { moderationRoutes } from './routes/moderation';
import { privacyRoutes } from './routes/privacy';
import { vendorRoutes } from './routes/vendor';
import { venueRoutes } from './routes/venues';

export interface AppOptions {
  corsOrigin?: string;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ corsOrigin = '*', logger = true }: AppOptions = {}) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();

  // roleGuard doldurur (bkz. lib/auth.ts); şekil sabit kalsın diye önceden tanımlı
  app.decorateRequest('actorId', '');

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    // Varsayılan yalnızca GET/HEAD/POST; PUT (yorum) ve DELETE (hesap, beğeni, engel) web'den de çalışsın
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  // Sadece route'ta config.rateLimit tanımlıysa devreye girer; anahtar önce cihaz kimliği.
  await app.register(rateLimit, {
    global: false,
    keyGenerator: (req) => (req.headers['x-device-id'] as string | undefined) ?? req.ip,
  });

  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        message: `Invalid ${err.validationContext ?? 'request'}`,
        details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      });
    }
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    }
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode && statusCode < 500) {
      return reply.code(statusCode).send({ error: (err as { code?: string }).code ?? 'BAD_REQUEST', message: (err as Error).message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
  });

  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  await app.register(venueRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(communityRoutes, { prefix: '/api/v1' });
  await app.register(moderationRoutes, { prefix: '/api/v1' });
  await app.register(adminRoutes, { prefix: '/api/v1' });
  await app.register(vendorRoutes, { prefix: '/api/v1' });
  await app.register(monetizationRoutes, { prefix: '/api/v1' });
  await app.register(mapRoutes);
  await app.register(mediaRoutes);
  await app.register(privacyRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
