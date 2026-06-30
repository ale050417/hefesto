import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const optional = z.preprocess(
  emptyToUndef,
  z.string().trim().max(120).optional(),
);

export const calcSaveSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre."),
  customer: optional,
  material: optional,
  color: optional,
  grams: z.coerce.number().min(0),
  hours: z.coerce.number().min(0),
  costPerKg: z.coerce.number().min(0),
  marginPct: z.coerce.number().min(0),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export type CalcSaveInput = z.infer<typeof calcSaveSchema>;

export const calcConfigSchema = z.object({
  kwhPrice: z.coerce.number().min(0),
  machineWatts: z.coerce.number().int().min(0),
  machineLifeHours: z.coerce.number().int().positive(),
  maintenanceCost: z.coerce.number().min(0),
  marginErrorPct: z.coerce.number().min(0).max(100),
});

export type CalcConfigInput = z.infer<typeof calcConfigSchema>;
