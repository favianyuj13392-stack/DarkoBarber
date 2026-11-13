import { FastifyPluginAsync } from 'fastify';
import { PhotosService } from './photos.service';
import { presignPhotoSchema, confirmPhotoSchema } from './photos.schemas';
import { AppError } from '../../utils/errors';
import { z } from 'zod';

const consentSchema = z.object({ isPublic: z.boolean() });

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
        return reply.status(200).send({
          ...result,
          uploadUrl: result.presignedUrl,
          key: result.r2Key,
          publicUrl: `https://${process.env.R2_BUCKET_NAME || 'darkobarber-photos'}.r2.cloudflarestorage.com/${result.r2Key}`,
        });
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

  // Alias POST /photos/presign (cutId in body)
  fastify.post(
    '/photos/presign',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const body = (request.body as Record<string, unknown>) || {};
      const cutId = (body.cutId || body.id) as string;
      if (!cutId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'cutId is required in body',
        });
      }

      const parseResult = presignPhotoSchema.safeParse(body);
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
          cutId,
          contentType,
          fastify.generatePresignedUrl
        );
        return reply.status(200).send({
          ...result,
          uploadUrl: result.presignedUrl,
          key: result.r2Key,
          publicUrl: `https://${process.env.R2_BUCKET_NAME || 'darkobarber-photos'}.r2.cloudflarestorage.com/${result.r2Key}`,
        });
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

  // Alias POST /photos/confirm (cutId in body)
  fastify.post(
    '/photos/confirm',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const body = (request.body as Record<string, unknown>) || {};
      const cutId = (body.cutId || body.id) as string;
      if (!cutId) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'cutId is required in body',
        });
      }

      const parseResult = confirmPhotoSchema.safeParse(body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const photo = await service.confirmPhoto(
          request.barber.id,
          cutId,
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

  // PATCH /photos/:photoId/consent: grant or revoke public portfolio consent.
  // Only the authenticated CLIENT who owns the photo (photo -> cut -> profile -> client) may change it.
  // The barber-side in-chair consent flow is separate: it goes through /presence/chair/consent-*
  // and the barber's isPublic flag on photo confirm.
  fastify.patch(
    '/photos/:photoId/consent',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const { photoId } = request.params as { photoId: string };
      const parseResult = consentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      const user = request.authUser!;
      if (user.role !== 'cliente') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Only the client who owns the photo can change its consent',
        });
      }

      const photo = await fastify.prisma.cutPhoto.findUnique({
        where: { id: photoId },
        include: { cut: { include: { clientProfile: true } } },
      });
      if (!photo) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Photo not found' });
      }
      if (photo.cut.clientProfile.clientId !== user.id) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'You do not own this photo',
        });
      }

      const updated = await fastify.prisma.cutPhoto.update({
        where: { id: photoId },
        data: { isPublic: parseResult.data.isPublic },
      });

      return reply.status(200).send(updated);
    }
  );
};
