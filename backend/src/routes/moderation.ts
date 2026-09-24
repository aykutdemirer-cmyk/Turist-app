import { blockUserSchema, reportContentSchema } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireUserId } from '../lib/auth';
import { blockUser, listBlocked, reportContent, unblockUser } from '../services/moderation.service';

const idParams = z.object({ id: z.string().min(1).max(100) });

/** Kullanıcı tarafı: şikayet et, engelle */
export const moderationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/moderation/reports',
    { schema: { body: reportContentSchema }, config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req, reply) => reply.code(201).send(await reportContent(await requireUserId(req), req.body)),
  );

  app.get('/moderation/blocks', async (req) => ({ items: await listBlocked(await requireUserId(req)) }));

  app.post(
    '/moderation/blocks',
    { schema: { body: blockUserSchema }, config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } },
    async (req, reply) => reply.code(201).send(await blockUser(await requireUserId(req), req.body.userId)),
  );

  app.delete('/moderation/blocks/:id', { schema: { params: idParams } }, async (req, reply) => {
    await unblockUser(await requireUserId(req), req.params.id);
    return reply.code(204).send();
  });
};
