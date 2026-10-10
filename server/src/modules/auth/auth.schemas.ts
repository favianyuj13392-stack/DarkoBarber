import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  secret: z.string().min(1, 'Secret is required'),
  type: z.enum(['pin', 'password']),
  deviceId: z.string().min(1, 'DeviceId is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
