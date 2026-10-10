import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ConfirmPhotoInput } from './photos.schemas';
import { ForbiddenError, NotFoundError } from '../../utils/errors';

export class PhotosService {
  constructor(private prisma: PrismaClient) {}

  async presignPhoto(
    barberId: string,
    cutId: string,
    contentType: string,
    generatePresignedUrl: (key: string, contentType: string) => Promise<string>
  ) {
    const cut = await this.prisma.cut.findUnique({
      where: { id: cutId },
    });

    if (!cut) {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    if (cut.barberId !== barberId) {
      throw new ForbiddenError('FORBIDDEN', 'Cannot presign photo for cut belonging to another barber');
    }

    const photoUuid = crypto.randomUUID();
    const r2Key = `cuts/${barberId}/${cutId}/${photoUuid}.webp`;
    const presignedUrl = await generatePresignedUrl(r2Key, contentType);

    return {
      presignedUrl,
      r2Key,
    };
  }

  async confirmPhoto(barberId: string, cutId: string, input: ConfirmPhotoInput) {
    const cut = await this.prisma.cut.findUnique({
      where: { id: cutId },
    });

    if (!cut) {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    if (cut.barberId !== barberId) {
      throw new ForbiddenError('FORBIDDEN', 'Cannot confirm photo for cut belonging to another barber');
    }

    const photo = await this.prisma.cutPhoto.create({
      data: {
        cutId,
        r2Key: input.r2Key,
        isPublic: input.isPublic ?? false,
      },
    });

    return photo;
  }
}
