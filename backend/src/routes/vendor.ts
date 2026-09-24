import { vendorAnnouncementSchema, vendorDishSchema, vendorLocationSchema, vendorOpenSchema } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { roleGuard } from '../lib/auth';
import { resolveLocale } from '../lib/locale';
import {
  createAnnouncement,
  listVendorVenues,
  setOpenOverride,
  updateDish,
  updateLiveLocation,
} from '../services/vendor.service';

const idParams = z.object({ id: z.string().min(1).max(100) });

/** Esnaf paneli: yalnızca VENDOR rolü, yalnızca sahibi olduğu mekan(lar) */
export const vendorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', roleGuard('VENDOR'));
  const locale = (acceptLanguage: string | undefined) => resolveLocale(undefined, acceptLanguage);

  app.get('/vendor/venues', async (req) => ({
    items: await listVendorVenues(req.actorId, locale(req.headers['accept-language'])),
  }));

  app.put(
    '/vendor/venues/:id/location',
    {
      schema: { params: idParams, body: vendorLocationSchema },
      config: { rateLimit: { max: 30, timeWindow: '10 minutes' } },
    },
    async (req) => updateLiveLocation(req.actorId, req.params.id, req.body, locale(req.headers['accept-language'])),
  );

  app.put('/vendor/venues/:id/open', { schema: { params: idParams, body: vendorOpenSchema } }, async (req) =>
    setOpenOverride(req.actorId, req.params.id, req.body.isOpen, locale(req.headers['accept-language'])),
  );

  app.post(
    '/vendor/venues/:id/announcements',
    {
      schema: { params: idParams, body: vendorAnnouncementSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (req, reply) => reply.code(201).send(await createAnnouncement(req.actorId, req.params.id, req.body)),
  );

  app.put('/vendor/dishes/:id', { schema: { params: idParams, body: vendorDishSchema } }, async (req) =>
    updateDish(req.actorId, req.params.id, req.body),
  );
};
