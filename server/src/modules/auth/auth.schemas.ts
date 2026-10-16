import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  secret: z.string().min(1, 'Secret is required'),
  type: z.enum(['pin', 'password']).default('password'),
  role: z.enum(['barbero', 'cliente']).default('barbero'),
  deviceId: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  displayName: z.string().min(1, 'El nombre es obligatorio'),
  role: z.enum(['barbero', 'cliente']).default('cliente'),
  phone: z.string().optional(),
  deviceId: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  role: z.enum(['barbero', 'cliente']).default('cliente'),
  deviceId: z.string().optional(),
});

export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
