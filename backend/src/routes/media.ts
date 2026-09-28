import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { fetchWikimediaImage, WIKIMEDIA_PROXY_PATH } from '../lib/imageProxy';

/**
 * Yerelde tutulan lisanslı yemek fotoğrafları (backend/media). Uygulama göreli /media/... yolunu API adresine
 * göre çözer; böylece kurumsal ağda HTTPS denetimi olsa bile emülatör görselleri yükleyebilir.
 */
const MEDIA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'media');

// Yalnızca düz dosya adları: dizin geçişi (../) mümkün değil
const params = z.object({
  folder: z.enum(['dishes', 'experiences']),
  file: z.string().regex(/^[a-z0-9-]+\.jpg$/),
});

export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
  // Wikimedia Commons görsel vekili (yalnızca Wikimedia adresleri; bkz. lib/imageProxy)
  app.get(
    WIKIMEDIA_PROXY_PATH,
    {
      schema: { querystring: z.object({ url: z.string().url().max(1000) }) },
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const image = await fetchWikimediaImage(req.query.url);
      if (!image) throw notFound('Image');
      return reply
        .header('Content-Type', image.contentType)
        .header('Cache-Control', 'public, max-age=604800')
        .send(image.body);
    },
  );

  app.get('/media/:folder/:file', { schema: { params } }, async (req, reply) => {
    let body: Buffer;
    try {
      body = await readFile(join(MEDIA_ROOT, req.params.folder, req.params.file));
    } catch {
      throw notFound('Image');
    }
    return reply
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'public, max-age=604800, immutable')
      .send(body);
  });
};
