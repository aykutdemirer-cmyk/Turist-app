import { adminReportsQuerySchema, blockUserSchema, reportContentSchema } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdminId, requireUserId } from '../lib/auth';
import { listDeletionRequests, processDeletionRequest } from '../services/privacy.service';
import {
  blockUser,
  dismissReport,
  listBlocked,
  listReports,
  removeReportedContent,
  reportContent,
  unblockUser,
} from '../services/moderation.service';

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

/** Yönetici: şikayetleri incele, içeriği kaldır ya da yoksay; web'den gelen silme taleplerini işle */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/admin/reports', { schema: { querystring: adminReportsQuerySchema } }, async (req) => {
    await requireAdminId(req);
    return { items: await listReports(req.query.status, req.query.limit) };
  });

  app.post('/admin/reports/:id/remove', { schema: { params: idParams } }, async (req, reply) => {
    await removeReportedContent(req.params.id, await requireAdminId(req));
    return reply.code(204).send();
  });

  app.post('/admin/reports/:id/dismiss', { schema: { params: idParams } }, async (req, reply) => {
    await dismissReport(req.params.id, await requireAdminId(req));
    return reply.code(204).send();
  });

  app.get('/admin/deletion-requests', async (req) => {
    await requireAdminId(req);
    return { items: await listDeletionRequests() };
  });

  /** Kimlik e-postayla doğrulandıktan sonra: complete → hesap silinir, reject → talep kapatılır */
  app.post(
    '/admin/deletion-requests/:id/:action',
    { schema: { params: idParams.extend({ action: z.enum(['complete', 'reject']) }) } },
    async (req) => {
      await requireAdminId(req);
      return processDeletionRequest(req.params.id, req.params.action);
    },
  );
};
