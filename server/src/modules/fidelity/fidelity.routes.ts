import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { FidelityService } from './fidelity.service';

const sendReminderSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
});

export const fidelityRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new FidelityService(fastify.prisma);

  /**
   * GET /barbers/me/stats/fidelity
   * Returns retention rate, average cycle days, top cut styles.
   * Gated to PRO.
   */
  fastify.get(
    '/barbers/me/stats/fidelity',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }

      const result = await service.getFidelityStats(barberId);
      return reply.status(200).send(result);
    }
  );

  /**
   * GET /barbers/me/clients/due-for-cut
   * Returns clients overdue for their next cut with WhatsApp CTA links.
   * Gated to PRO.
   */
  fastify.get(
    '/barbers/me/clients/due-for-cut',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }

      const result = await service.getDueForCutClients(barberId);
      return reply.status(200).send(result);
    }
  );

  /**
   * POST /barbers/me/notifications/send-reminder
   * Dispatches a branded reminder email to a client due for a cut.
   * Gated to PRO with rate limiting (12 emails/mo).
   */
  fastify.post(
    '/barbers/me/notifications/send-reminder',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' });
      }

      const parsed = sendReminderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.format(),
        });
      }

      const result = await service.sendDueForCutReminder(barberId, parsed.data.clientId);

      if ('error' in result) {
        switch (result.error) {
          case 'FORBIDDEN':
            return reply.status(403).send(result);
          case 'QUOTA_EXCEEDED':
            return reply.status(429).send(result);
          case 'CLIENT_NO_EMAIL':
            return reply.status(400).send(result);
          default:
            return reply.status(500).send(result);
        }
      }

      return reply.status(200).send(result);
    }
  );
};
