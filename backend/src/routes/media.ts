import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { notFound } from '../lib/errors';

/**
 * Yerelde tutulan lisanslı yemek fotoğrafları (backend/media). Uygulama göreli /media/... yolunu API adresine
 * göre çözer; böylece kurumsal ağda HTTPS denetimi olsa bile emülatör görselleri yükleyebilir.
 */
const MEDIA_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'media');

// Yalnızca düz dosya adları: dizin geçişi (../) mümkün değil
const params = z.object({
  folder: z.enum(['dishes']),
  file: z.string().regex(/^[a-z0-9-]+\.jpg$/),
});

export const mediaRoutes: FastifyPluginAsyncZod = async (app) => {
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
