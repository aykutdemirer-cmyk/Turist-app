import {
  adminAnnouncementsQuerySchema,
  adminPromotedSchema,
  adminReportsQuerySchema,
  adminVenuesQuerySchema,
} from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { roleGuard } from '../lib/auth';
import { resolveLocale } from '../lib/locale';
import {
  listAdminVenues,
  listAnnouncements,
  moderateLiveLocation,
  reviewAnnouncement,
  reviewVenue,
  setPromoted,
} from '../services/admin.service';
import { dismissReport, listReports, removeReportedContent } from '../services/moderation.service';
import { listDeletionRequests, processDeletionRequest } from '../services/privacy.service';

const idParams = z.object({ id: z.string().min(1).max(100) });
const decisionParams = idParams.extend({ decision: z.enum(['approve', 'reject']) });

/** Yönetim merkezi: yalnızca SUPER_ADMIN (tüm /admin/* bu kapsamda) */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', roleGuard('SUPER_ADMIN'));
  const locale = (acceptLanguage: string | undefined) => resolveLocale(undefined, acceptLanguage);

  // ── İçerik moderasyonu ──
  app.get('/admin/reports', { schema: { querystring: adminReportsQuerySchema } }, async (req) => ({
    items: await listReports(req.query.status, req.query.limit),
  }));

  app.post('/admin/reports/:id/remove', { schema: { params: idParams } }, async (req, reply) => {
    await removeReportedContent(req.params.id, req.actorId);
    return reply.code(204).send();
  });

  app.post('/admin/reports/:id/dismiss', { schema: { params: idParams } }, async (req, reply) => {
    await dismissReport(req.params.id, req.actorId);
    return reply.code(204).send();
  });

  app.get('/admin/deletion-requests', async () => ({ items: await listDeletionRequests() }));

  /** Kimlik e-postayla doğrulandıktan sonra: complete → hesap silinir, reject → talep kapatılır */
  app.post(
    '/admin/deletion-requests/:id/:action',
    { schema: { params: idParams.extend({ action: z.enum(['complete', 'reject']) }) } },
    async (req) => processDeletionRequest(req.params.id, req.params.action),
  );

  // ── Mekanlar: başvuru onayı, sponsorluk, canlı konum denetimi ──
  app.get('/admin/venues', { schema: { querystring: adminVenuesQuerySchema } }, async (req) => ({
    items: await listAdminVenues(req.query, locale(req.headers['accept-language'])),
  }));

  app.post('/admin/venues/:id/:decision', { schema: { params: decisionParams } }, async (req) =>
    reviewVenue(req.params.id, req.params.decision, locale(req.headers['accept-language'])),
  );

  app.put('/admin/venues/:id/promoted', { schema: { params: idParams, body: adminPromotedSchema } }, async (req) =>
    setPromoted(req.params.id, req.body.isPromoted, locale(req.headers['accept-language'])),
  );

  app.post(
    '/admin/venues/:id/live-location/:action',
    { schema: { params: idParams.extend({ action: z.enum(['pin', 'reset']) }) } },
    async (req) => moderateLiveLocation(req.params.id, req.params.action, locale(req.headers['accept-language'])),
  );

  // ── Satıcı duyuruları ──
  app.get('/admin/announcements', { schema: { querystring: adminAnnouncementsQuerySchema } }, async (req) => ({
    items: await listAnnouncements(req.query.status),
  }));

  app.post('/admin/announcements/:id/:decision', { schema: { params: decisionParams } }, async (req) =>
    reviewAnnouncement(req.params.id, req.params.decision),
  );
};
