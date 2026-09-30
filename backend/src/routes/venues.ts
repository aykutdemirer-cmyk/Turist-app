import {
  deviceIdSchema,
  latitudeSchema,
  localeSchema,
  longitudeSchema,
  nearbyQuerySchema,
  placeHoursInputSchema,
  dishInputSchema,
  venueClaimSchema,
  recentConfirmationsQuerySchema,
  reportInputSchema,
  reviewInputSchema,
  suggestVenueSchema,
} from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { optionalUserId, requireUserId } from '../lib/auth';
import { resolveLocale } from '../lib/locale';
import { recentConfirmations, submitReport } from '../services/report.service';
import { upsertReview } from '../services/review.service';
import { suggestVenue } from '../services/suggest.service';
import { fetchGooglePhoto, fetchStreetView, PHOTO_NAME_PATTERN } from '../services/google-places.service';
import { claimVenue, saveCommunityHours, suggestDish } from '../services/real-venues.service';
import { findNearbyVenues, getVenueDetail } from '../services/venue.service';

// looseObject: doğrulanan değer request.headers'ın yerine geçtiği için diğer header'ları korur.
const deviceHeaders = z.looseObject({ 'x-device-id': deviceIdSchema });

export const venueRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/confirmations/recent',
    { schema: { querystring: recentConfirmationsQuerySchema } },
    async (req) => ({ items: await recentConfirmations(req.query) }),
  );

  app.get(
    '/venues/nearby',
    { schema: { querystring: nearbyQuerySchema } },
    async (req) =>
      findNearbyVenues(req.query, resolveLocale(req.query.locale, req.headers['accept-language']), req.log),
  );

  // "Bu mekan benim": gerçek dükkanın sahibi başvurur, Super Admin onaylar
  app.post(
    '/venues/:id/claim',
    {
      schema: { params: z.object({ id: z.string().min(1).max(100) }), body: venueClaimSchema },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req, reply) => reply.code(201).send(await claimVenue(req.params.id, await requireUserId(req), req.body)),
  );

  // Menüye lezzet önerisi (onaydan sonra menüde, görseliyle)
  app.post(
    '/venues/:id/dish-suggestions',
    {
      schema: { params: z.object({ id: z.string().min(1).max(100) }), body: dishInputSchema },
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
    async (req, reply) => reply.code(201).send(await suggestDish(req.params.id, await requireUserId(req), req.body)),
  );

  // Topluluk saatleri: sahiplenilmemiş gerçek mekanın haftalık saatlerini üye günceller
  app.put(
    '/venues/:id/hours',
    {
      schema: { params: z.object({ id: z.string().min(1).max(100) }), body: placeHoursInputSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => saveCommunityHours(req.params.id, await requireUserId(req), req.body),
  );

  // Google Places fotoğraf vekili: API anahtarı istemciye hiç gitmez (günlük ücretsiz kota sınırıyla)
  app.get(
    '/places/photo',
    {
      schema: { querystring: z.object({ name: z.string().max(600).regex(PHOTO_NAME_PATTERN) }) },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const photo = await fetchGooglePhoto(req.query.name).catch(() => null);
      if (!photo) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Photo not found' });
      // Uygulama bir hafta önbellekte tutsun: aynı fotoğraf kotadan tekrar düşmesin
      return reply.header('Content-Type', photo.contentType).header('Cache-Control', 'public, max-age=604800').send(photo.body);
    },
  );

  // Dükkân cephesi (Street View) vekili: işletmenin kendi fotoğrafı olmayan Google mekanlarının kapağı
  app.get(
    '/places/streetview',
    {
      schema: { querystring: z.object({ lat: latitudeSchema, lng: longitudeSchema }) },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const photo = await fetchStreetView({ latitude: req.query.lat, longitude: req.query.lng }).catch(() => null);
      if (!photo) return reply.code(404).send({ error: 'NOT_FOUND', message: 'Street view not found' });
      return reply.header('Content-Type', photo.contentType).header('Cache-Control', 'public, max-age=604800').send(photo.body);
    },
  );

  app.get(
    '/venues/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1).max(100) }),
        querystring: z.object({ locale: localeSchema.optional() }),
      },
    },
    async (req) =>
      getVenueDetail(
        req.params.id,
        resolveLocale(req.query.locale, req.headers['accept-language']),
        await optionalUserId(req),
      ),
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

  // Üye yorumu: aynı mekana tekrar gönderilirse günceller
  app.put(
    '/venues/:id/review',
    {
      schema: { params: z.object({ id: z.string().min(1).max(100) }), body: reviewInputSchema },
      config: { rateLimit: { max: 10, timeWindow: '10 minutes' } },
    },
    async (req) => upsertReview(req.params.id, await requireUserId(req), req.body),
  );
};
