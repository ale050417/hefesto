import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);

export const costSettingsSchema = z.object({
  kwhPrice: z.coerce.number().min(0, "No puede ser negativo."),
  machineWatts: z.coerce.number().int().min(0, "No puede ser negativo."),
  machineLifeHours: z.coerce.number().int().positive("Debe ser mayor a 0."),
  maintenanceCost: z.coerce.number().min(0, "No puede ser negativo."),
});

export const profitShareSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre."),
  role: z.preprocess(emptyToUndef, z.string().trim().max(60).optional()),
  pct: z.coerce.number().min(0, "Mínimo 0").max(100, "Máximo 100"),
});

export type CostSettingsInput = z.infer<typeof costSettingsSchema>;
export type ProfitShareInput = z.infer<typeof profitShareSchema>;
