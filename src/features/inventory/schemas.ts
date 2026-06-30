import { z } from "zod";

export const filamentSchema = z.object({
  material: z.string().trim().min(1, "Ingresá el material."),
  color: z.string().trim().min(1, "Ingresá el color."),
  brand: z.string().trim().min(1, "Ingresá la marca."),
  diameter: z.string().trim().min(1, "Ingresá el diámetro."),
  stockGrams: z.coerce.number().min(0, "El stock no puede ser negativo."),
  spoolGrams: z.coerce
    .number()
    .positive("El tamaño del carrete debe ser mayor a 0."),
  costPerKg: z.coerce.number().min(0, "El costo no puede ser negativo."),
  alertThresholdGrams: z.coerce
    .number()
    .min(0, "El umbral no puede ser negativo."),
});

export const failureSchema = z.object({
  pieceName: z.string().trim().min(1, "Ingresá la pieza."),
  material: z.string().trim().min(1, "Ingresá el material."),
  color: z.string().trim().min(1, "Ingresá el color."),
  gramsLost: z.coerce.number().positive("Los gramos deben ser mayores a 0."),
  reason: z.string().trim().min(1, "Ingresá la causa."),
  notes: z.string().trim().max(500).optional(),
  deducted: z.boolean().optional(),
});

export type FilamentInput = z.infer<typeof filamentSchema>;
export type FailureInput = z.infer<typeof failureSchema>;
