import { z } from 'zod';

export const startCutSchema = z.object({
  clientProfileId: z.string().optional(),
  clientPhone: z.string().optional(),
  clientName: z.string().optional(),
  clientRequestId: z.string().min(1, 'Client request ID is required'),
  startedAt: z.string().optional(),
});

export const chipsSchema = z.object({
  baseLateral: z.string().min(1, 'Base lateral is required'),
  tipoDegradado: z.string().min(1, 'Tipo degradado is required'),
  parteSuperior: z.string().min(1, 'Parte superior is required'),
  barba: z.object({
    included: z.boolean(),
    alturaMejilla: z.string().optional(),
  }),
  adicionales: z.array(z.string()).default([]),
  notasEspeciales: z.array(z.string()).optional(),
});

export const finalizeCutSchema = z.object({
  chips: chipsSchema,
  finishedAt: z.string().optional(),
  photos: z
    .array(
      z.object({
        url: z.string(),
        angle: z.string().optional(),
      })
    )
    .optional(),
  isPublic: z.boolean().optional(),
});

export type StartCutInput = z.infer<typeof startCutSchema>;
export type FinalizeCutInput = z.infer<typeof finalizeCutSchema>;
