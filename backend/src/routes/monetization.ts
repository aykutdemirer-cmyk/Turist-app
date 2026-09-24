import { localeSchema } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../env';
import { optionalUserId, requireUserId } from '../lib/auth';
import { HttpError, notFound } from '../lib/errors';
import { resolveLocale } from '../lib/locale';
import { me } from '../services/auth.service';
import { listExperiences } from '../services/experience.service';
import { getTrail, listTrails } from '../services/trail.service';

/** Tek seferlik Explorer Pass: süresiz erişim (tarih alanı ileride abonelik için de kullanılabilir) */
const LIFETIME = new Date('2100-01-01T00:00:00Z');

export const monetizationRoutes: FastifyPluginAsyncZod = async (app) => {
  // İş ortaklığı deneyimleri: mekan verilirse o ilçeye uygun olanlar
  app.get(
    '/experiences',
    { schema: { querystring: z.object({ venueId: z.string().min(1).max(100).optional(), locale: localeSchema.optional() }) } },
    async (req) => {
      const locale = resolveLocale(req.query.locale, req.headers['accept-language']);
      let district: string | null = null;
      if (req.query.venueId) {
        const venue = await prisma.venue.findUnique({ where: { id: req.query.venueId }, select: { district: true } });
        if (!venue) throw notFound('Venue');
        district = venue.district;
      }
      return { items: listExperiences(locale, district) };
    },
  );

  app.get('/trails', { schema: { querystring: z.object({ locale: localeSchema.optional() }) } }, async (req) => ({
    items: await listTrails(resolveLocale(req.query.locale, req.headers['accept-language']), await optionalUserId(req)),
  }));

  app.get(
    '/trails/:slug',
    { schema: { params: z.object({ slug: z.string().min(1).max(100) }), querystring: z.object({ locale: localeSchema.optional() }) } },
    async (req) =>
      getTrail(req.params.slug, resolveLocale(req.query.locale, req.headers['accept-language']), await optionalUserId(req)),
  );

  /**
   * Test satın alması (StoreKit / Google Play Billing bağlanana kadar). Üretimde her zaman 403.
   * Gerçek akışta istemci mağaza makbuzunu gönderir, sunucu mağaza API'siyle doğrular.
   */
  app.post('/billing/mock-purchase', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req) => {
    if (!env.ALLOW_MOCK_PURCHASES) throw new HttpError(403, 'MOCK_PURCHASES_DISABLED', 'Test purchases are disabled');
    const userId = await requireUserId(req);
    await prisma.user.update({ where: { id: userId }, data: { premiumUntil: LIFETIME, premiumSource: 'mock' } });
    return { user: await me(userId) };
  });

  /** Satın alımları geri yükle: hesaptaki güncel Pass durumunu döner (mağaza doğrulaması eklenecek) */
  app.post('/billing/restore', async (req) => ({ user: await me(await requireUserId(req)) }));
};
