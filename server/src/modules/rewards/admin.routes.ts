import crypto from 'node:crypto';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getRewardsConfig } from './rewards.config';
import { ClaimsAdminService, ClaimTransition } from './claims-admin.service';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest();

/** Constant-time comparison of two secrets (hashed first so lengths always match). */
export function adminKeyMatches(provided: string, expected: string): boolean {
  return crypto.timingSafeEqual(sha256(provided), sha256(expected));
}

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REVERSED']).optional(),
});
const idParamsSchema = z.object({ id: z.string().min(1).max(64) });
const rejectBodySchema = z.object({ note: z.string().trim().min(1).max(500) });
const reverseBodySchema = z
  .object({ note: z.string().trim().max(500).optional(), revokeClients: z.boolean().optional() })
  .default({});

/**
 * Admin API for the rewards pilot. Fail-closed: without ADMIN_API_KEY every route
 * answers 404; with it, the `x-admin-key` header must match.
 */
export const adminRewardsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ClaimsAdminService(fastify.prisma);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const { adminApiKey } = getRewardsConfig();
    if (!adminApiKey) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Not found' });
    }
    const header = request.headers['x-admin-key'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Admin key required' });
    }
    if (!adminKeyMatches(provided, adminApiKey)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Invalid admin key' });
    }
  });

  const respond = (reply: FastifyReply, result: ClaimTransition) => {
    if (result.ok) return reply.status(200).send({ success: true, claim: result.claim });
    const map = {
      NOT_FOUND: [404, 'Claim not found'],
      INVALID_STATE: [409, 'Claim is not in a state that allows this action'],
      CAP_REACHED: [409, 'Barber already reached the free months cap'],
    } as const;
    const [status, message] = map[result.reason];
    return reply.status(status).send({ error: result.reason, message });
  };

  // GET /admin/rewards/claims?status=PENDING
  fastify.get('/claims', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid status filter' });
    }
    const claims = await service.listClaims(parsed.data.status);
    return reply.status(200).send({ claims });
  });

  fastify.post('/claims/:id/approve', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: 'VALIDATION_ERROR' });
    return respond(reply, await service.approve(params.data.id));
  });

  fastify.post('/claims/:id/reject', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const body = rejectBodySchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'A note is required to reject a claim' });
    }
    return respond(reply, await service.reject(params.data.id, body.data.note));
  });

  fastify.post('/claims/:id/reverse', async (request, reply) => {
    const params = idParamsSchema.safeParse(request.params);
    const body = reverseBodySchema.safeParse(request.body ?? {});
    if (!params.success || !body.success) return reply.status(400).send({ error: 'VALIDATION_ERROR' });
    return respond(reply, await service.reverse(params.data.id, body.data));
  });
};
