import { z } from "zod";

export const filamentSchema = z.object({
  material: z.string().trim().min(1, "Ingresá el material."),
  color: z.string().trim().min(1, "Ingresá el color."),
  stockGrams: z.coerce.number().min(0, "El stock no puede ser negativo."),
  alertThresholdGrams: z.coerce
    .number()
    .min(0, "El umbral no puede ser negativo."),
});

export const failureSchema = z.object({
  filamentId: z.uuid("Elegí un filamento."),
  pieceName: z.string().trim().min(1, "Ingresá la pieza."),
  gramsLost: z.coerce.number().positive("Los gramos deben ser mayores a 0."),
  reason: z.string().trim().min(1, "Ingresá la causa."),
  notes: z.string().trim().max(500).optional(),
  deducted: z.boolean().optional(),
});

export type FilamentInput = z.infer<typeof filamentSchema>;
export type FailureInput = z.infer<typeof failureSchema>;
