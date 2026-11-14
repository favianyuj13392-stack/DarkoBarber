import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { EmailVerificationService } from './email-verification.service';
import { evaluateQualificationSafely } from './rewards.hooks';

const verifyEmailSchema = z.object({
  token: z.string().min(3).max(256),
});

export const emailVerificationRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new EmailVerificationService(fastify.prisma);

  // GET /clients/me/email/status (client role only): read-only verification status
  fastify.get(
    '/clients/me/email/status',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      if (request.authUser?.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Client account required' });
      }

      const client = await fastify.prisma.client.findUnique({
        where: { id: request.authUser.id },
        select: { email: true, emailVerifiedAt: true },
      });
      if (!client) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client not found' });
      }

      return reply.status(200).send({
        email: client.email,
        verified: client.emailVerifiedAt !== null,
      });
    }
  );

  // POST /clients/me/email/verify-request (client role only)
  fastify.post(
    '/clients/me/email/verify-request',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      if (request.authUser?.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Client account required' });
      }

      const result = await service.requestVerification(request.authUser.id);
      switch (result.status) {
        case 'ALREADY_VERIFIED':
          return reply.status(200).send({ verified: true });
        case 'SENT':
          return reply.status(200).send({ verified: false, sent: true });
        case 'NO_EMAIL':
          return reply.status(400).send({ error: 'NO_EMAIL', message: 'Add an email address first' });
        case 'RATE_LIMITED':
          if (result.retryAfterSeconds) {
            reply.header('Retry-After', String(result.retryAfterSeconds));
          }
          return reply.status(429).send({
            error: 'RATE_LIMITED',
            message: 'Too many verification emails requested. Try again later.',
          });
        case 'SEND_FAILED':
          return reply.status(502).send({ error: 'EMAIL_SEND_FAILED', message: 'Could not send the email' });
        default:
          return reply.status(404).send({ error: 'NOT_FOUND', message: 'Client not found' });
      }
    }
  );

  // POST /auth/email/verify (public)
  fastify.post('/auth/email/verify', async (request, reply) => {
    const parsed = verifyEmailSchema.safeParse(request.body);
    const clientId = parsed.success ? await service.verifyToken(parsed.data.token) : null;

    if (!clientId) {
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'This verification link is invalid or has expired.',
      });
    }

    await evaluateQualificationSafely(fastify.prisma, clientId);
    return reply.status(200).send({ verified: true });
  });
};
