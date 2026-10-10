import { FastifyPluginAsync } from 'fastify';
import { PhotosService } from './photos.service';
import { presignPhotoSchema, confirmPhotoSchema } from './photos.schemas';
import { AppError } from '../../utils/errors';

export const photosRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new PhotosService(fastify.prisma);

  fastify.post(
    '/cuts/:id/photos/presign',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = presignPhotoSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const contentType = parseResult.data.contentType || 'image/webp';
        const result = await service.presignPhoto(
          request.barber.id,
          id,
          contentType,
          fastify.generatePresignedUrl
        );
        return reply.status(200).send(result);
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
    '/cuts/:id/photos/confirm',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = confirmPhotoSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const photo = await service.confirmPhoto(
          request.barber.id,
          id,
          parseResult.data
        );
        return reply.status(201).send({ photo });
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
