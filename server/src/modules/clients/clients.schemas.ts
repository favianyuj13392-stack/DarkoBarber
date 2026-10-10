import { z } from 'zod';

export const createClientSchema = z.object({
  phone: z.string().min(5, 'Phone number must be at least 5 digits'),
  name: z.string().min(1, 'Client name is required'),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
