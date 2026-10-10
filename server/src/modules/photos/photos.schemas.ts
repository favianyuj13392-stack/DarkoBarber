import { z } from 'zod';

export const presignPhotoSchema = z.object({
  contentType: z.string().default('image/webp').optional(),
});

export const confirmPhotoSchema = z.object({
  r2Key: z.string().min(1, 'r2Key is required'),
  isPublic: z.boolean().optional().default(false),
});

export type PresignPhotoInput = z.infer<typeof presignPhotoSchema>;
export type ConfirmPhotoInput = z.infer<typeof confirmPhotoSchema>;
