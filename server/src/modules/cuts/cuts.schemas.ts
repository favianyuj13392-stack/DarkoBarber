import { z } from 'zod';

export const startCutSchema = z.object({
  clientProfileId: z.string().optional(),
  clientId: z.string().optional(),
  clientPhone: z.string().optional(),
  clientName: z.string().optional(),
  clientRequestId: z.string().min(1, 'Client request ID is required'),
  startedAt: z.string().optional(),
});

export const chipsSchema = z.object({
  baseLateral: z.string().optional(),
  tipoDegradado: z.string().optional(),
  parteSuperior: z.string().optional(),
  barba: z
    .object({
      included: z.boolean(),
      alturaMejilla: z.string().optional(),
    })
    .optional(),
  adicionales: z.array(z.string()).optional().default([]),
  notasEspeciales: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
  sameAsLastTime: z.boolean().optional(),
  styleName: z.string().optional(),
});

export const finalizeCutSchema = z.object({
  sameAsLastTime: z.boolean().optional().default(false),
  notes: z.string().max(500).optional(),
  chips: chipsSchema.or(z.record(z.any())).optional(),
  finishedAt: z.string().optional(),
  photos: z
    .array(
      z.object({
        url: z.string(),
        angle: z.string().optional(),
      })
    )
    .max(5, 'Maximum of 5 photos allowed')
    .optional()
    .default([]),
  isPublic: z.boolean().optional().default(false),
});

export type StartCutInput = z.infer<typeof startCutSchema>;
export type FinalizeCutInput = z.infer<typeof finalizeCutSchema>;
