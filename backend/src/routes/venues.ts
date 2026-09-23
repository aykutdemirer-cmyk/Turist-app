import {
  deviceIdSchema,
  localeSchema,
  nearbyQuerySchema,
  reportInputSchema,
  suggestVenueSchema,
} from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { resolveLocale } from '../lib/locale';
import { submitReport } from '../services/report.service';
import { suggestVenue } from '../services/suggest.service';
import { findNearbyVenues, getVenueDetail } from '../services/venue.service';

// looseObject: doğrulanan değer request.headers'ın yerine geçtiği için diğer header'ları korur.
const deviceHeaders = z.looseObject({ 'x-device-id': deviceIdSchema });

export const venueRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/venues/nearby',
    { schema: { querystring: nearbyQuerySchema } },
    async (req) => findNearbyVenues(req.query, resolveLocale(req.query.locale, req.headers['accept-language'])),
  );

  app.get(
    '/venues/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1).max(100) }),
        querystring: z.object({ locale: localeSchema.optional() }),
      },
    },
    async (req) => getVenueDetail(req.params.id, resolveLocale(req.query.locale, req.headers['accept-language'])),
  );

  app.post(
    '/venues/:id/report',
    {
      schema: {
        params: z.object({ id: z.string().min(1).max(100) }),
        headers: deviceHeaders,
        body: reportInputSchema,
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const result = await submitReport(req.params.id, req.headers['x-device-id'], req.body);
      return reply.code(201).send(result);
    },
  );

  app.post(
    '/venues/suggest',
    {
      schema: { headers: deviceHeaders, body: suggestVenueSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const venue = await suggestVenue(req.headers['x-device-id'], req.body);
      return reply.code(201).send(venue);
    },
  );
};
