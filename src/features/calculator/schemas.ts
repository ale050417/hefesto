import { z } from "zod";

const emptyToUndef = (v: unknown) => (v === "" || v == null ? undefined : v);
const optional = z.preprocess(
  emptyToUndef,
  z.string().trim().max(120).optional(),
);

export const calcSaveSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre."),
  customer: optional,
  // El filamento CONCRETO (no el material): dos PLA de distinto color pueden
  // costar distinto. Material/color se snapshotean en el servidor desde este id
  // (auditoría 2026-07, fix "el precio no cambia según el filamento").
  filamentId: z.uuid("Elegí un filamento."),
  grams: z.coerce.number().min(0),
  hours: z.coerce.number().min(0),
  // El tipo de producto define el margen (resuelto en el servidor). El cliente
  // nunca manda el % ni el costo: se resuelven desde el tipo y el filamento.
  presetId: z.string().trim().min(1, "Elegí un tipo de producto."),
  notes: z.preprocess(emptyToUndef, z.string().trim().max(500).optional()),
});

export type CalcSaveInput = z.infer<typeof calcSaveSchema>;

// Cotización del operador: mismo criterio (filamento por id, nunca por nombre).
export const quotePriceSchema = z.object({
  presetId: z.string().trim().min(1, "Elegí un tipo de producto."),
  filamentId: z.uuid("Elegí un filamento."),
  grams: z.coerce.number().min(0),
  hours: z.coerce.number().min(0),
});

export type QuotePriceInput = z.infer<typeof quotePriceSchema>;

export const calcConfigSchema = z.object({
  kwhPrice: z.coerce.number().min(0),
  machineWatts: z.coerce.number().int().min(0),
  machineLifeHours: z.coerce.number().int().positive(),
  maintenanceCost: z.coerce.number().min(0),
  marginErrorPct: z.coerce.number().min(0).max(100),
});

export type CalcConfigInput = z.infer<typeof calcConfigSchema>;

// Tipo de producto con margen (lo administra el admin). El margen puede ser
// >100% (ej: 200%), por eso solo se valida >= 0.
export const marginPresetSchema = z.object({
  name: z.string().trim().min(1, "Ingresá un nombre.").max(120),
  marginPct: z.coerce.number().min(0, "El margen no puede ser negativo."),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type MarginPresetInput = z.infer<typeof marginPresetSchema>;
