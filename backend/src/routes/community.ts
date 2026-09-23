import { createCommentSchema, createPostSchema, feedQuerySchema } from '@localbite/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { optionalUserId, requireUserId } from '../lib/auth';
import { addComment, createPost, getPost, listFeed, setLike } from '../services/community.service';

const postParams = z.object({ id: z.string().min(1).max(100) });

export const communityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/community/posts', { schema: { querystring: feedQuerySchema } }, async (req) =>
    listFeed(req.query, await optionalUserId(req)),
  );

  app.get('/community/posts/:id', { schema: { params: postParams } }, async (req) =>
    getPost(req.params.id, await optionalUserId(req)),
  );

  app.post(
    '/community/posts',
    { schema: { body: createPostSchema }, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => reply.code(201).send(await createPost(await requireUserId(req), req.body)),
  );

  app.post(
    '/community/posts/:id/comments',
    { schema: { params: postParams, body: createCommentSchema }, config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } },
    async (req, reply) => reply.code(201).send(await addComment(req.params.id, await requireUserId(req), req.body)),
  );

  app.put(
    '/community/posts/:id/like',
    { schema: { params: postParams }, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => setLike(req.params.id, await requireUserId(req), true),
  );

  app.delete(
    '/community/posts/:id/like',
    { schema: { params: postParams }, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => setLike(req.params.id, await requireUserId(req), false),
  );
};
