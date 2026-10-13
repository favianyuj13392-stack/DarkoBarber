import { FastifyPluginAsync } from 'fastify';
import { CutsService } from './cuts.service';
import { startCutSchema, finalizeCutSchema } from './cuts.schemas';
import { AppError } from '../../utils/errors';

export const cutsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new CutsService(fastify.prisma, fastify.presenceService);

  fastify.post(
    '/cuts',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const parseResult = startCutSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const { cut, isDuplicate } = await service.startCut(
          request.barber,
          parseResult.data
        );
        const statusCode = isDuplicate ? 200 : 201;
        return reply.status(statusCode).send({ cut });
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    }
  );

  fastify.post(
    '/cuts/:id/finalize',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = finalizeCutSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const cut = await service.finalizeCut(
          request.barber.id,
          id,
          parseResult.data
        );
        return reply.status(200).send({ cut });
      } catch (err: any) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    }
  );
};
