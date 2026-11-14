import { z } from 'zod';

export const createClientSchema = z.object({
  phone: z.string().min(5, 'Phone number must be at least 5 digits'),
  name: z.string().min(1, 'Client name is required'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

// Identity fields (id, email) are intentionally not accepted: unknown keys are stripped.
export const updateClientProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  avatarUrl: z.string().max(2048).optional(),
});

export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;
