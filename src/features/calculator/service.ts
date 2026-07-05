import * as repo from "./repository";
import { isAdmin } from "@/core/auth/permissions";
import { listFilamentsView } from "@/features/inventory/queries";
import {
  computeQuote,
  resolveCostPerKg,
  selectActiveMargin,
} from "./calculator";
import type {
  CalcConfigInput,
  CalcSaveInput,
  MarginPresetInput,
} from "./schemas";

export type CalcConfig = {
  kwhPrice: number;
  machineWatts: number;
  machineLifeHours: number;
  maintenanceCost: number;
  marginErrorPct: number;
};

const DEFAULTS: CalcConfig = {
  kwhPrice: 95,
  machineWatts: 220,
  machineLifeHours: 8000,
  maintenanceCost: 320000,
  marginErrorPct: 8,
};

export async function getCalcConfig(): Promise<CalcConfig> {
  const row = await repo.getCostConfigRow();
  if (!row) return DEFAULTS;
  return {
    kwhPrice: Number(row.kwhPrice),
    machineWatts: row.machineWatts,
    machineLifeHours: row.machineLifeHours,
    maintenanceCost: Number(row.maintenanceCost),
    marginErrorPct: Number(row.marginErrorPct),
  };
}

export async function listHistory() {
  return repo.listCalcHistory();
}

export async function getStats() {
  return repo.getCalcStats();
}

/**
 * Guarda un cálculo en el historial. El margen sale del TIPO elegido (resuelto
 * en el servidor, nunca del cliente); `costPerKg` y el snapshot material/color
 * los resuelve la action desde el FILAMENTO elegido (por id, no por nombre).
 * Lanza si el tipo no existe o está inactivo.
 */
export async function createCalc(
  input: CalcSaveInput & { material: string | null; color: string | null },
  costPerKg: number,
  userId: string | null,
) {
  const presets = (await repo.listMarginPresets()).map(toPreset);
  const marginPct = selectActiveMargin(presets, input.presetId);
  if (marginPct == null) {
    throw new Error("El tipo de producto no está disponible.");
  }
  const cfg = await getCalcConfig();
  const q = computeQuote({
    grams: input.grams,
    hours: input.hours,
    costPerKg,
    kwhPrice: cfg.kwhPrice,
    machineWatts: cfg.machineWatts,
    machineLifeHours: cfg.machineLifeHours,
    maintenanceCost: cfg.maintenanceCost,
    marginErrorPct: cfg.marginErrorPct,
    marginPct,
  });
  return repo.insertCalcHistory({
    name: input.name,
    customer: input.customer ?? null,
    material: input.material ?? null,
    color: input.color ?? null,
    grams: String(input.grams),
    hours: String(input.hours),
    costPerKg: String(costPerKg),
    marginPct: String(marginPct),
    costoTotal: String(q.costoTotal),
    ganancia: String(q.ganancia),
    precioFinal: String(q.precioFinal),
    notes: input.notes ?? null,
    createdBy: userId,
  });
}

export async function deleteCalc(id: string) {
  return repo.deleteCalcHistoryRow(id);
}

/* ---------- Tipos de producto con margen ---------- */

// Tipo completo (con margen) — SOLO para el admin.
export type MarginPreset = {
  id: string;
  name: string;
  marginPct: number;
  active: boolean;
  sortOrder: number;
};

// Opción segura para el operador: nombre sin margen (el % no viaja al cliente).
export type MarginPresetOption = { id: string; name: string };

function toPreset(r: repo.MarginPresetRow): MarginPreset {
  return {
    id: r.id,
    name: r.name,
    marginPct: Number(r.marginPct),
    active: r.active,
    sortOrder: r.sortOrder,
  };
}

/** Todos los tipos (admin: incluye inactivos y el margen). */
export async function listMarginPresets(): Promise<MarginPreset[]> {
  return (await repo.listMarginPresets()).map(toPreset);
}

/** Solo nombre+id de los tipos activos (operador: sin filtrar el margen). */
export async function listActivePresetOptions(): Promise<MarginPresetOption[]> {
  return (await repo.listActiveMarginPresets()).map((r) => ({
    id: r.id,
    name: r.name,
  }));
}

export async function createMarginPreset(input: MarginPresetInput) {
  return repo.insertMarginPreset({
    name: input.name,
    marginPct: String(input.marginPct),
    active: input.active,
    sortOrder: input.sortOrder,
  });
}

export async function updateMarginPreset(id: string, input: MarginPresetInput) {
  return repo.updateMarginPresetRow(id, {
    name: input.name,
    marginPct: String(input.marginPct),
    active: input.active,
    sortOrder: input.sortOrder,
  });
}

export async function deleteMarginPreset(id: string) {
  return repo.deleteMarginPresetRow(id);
}

/**
 * Cotización para el OPERADOR: el margen sale del tipo elegido en el SERVIDOR
 * (nunca se confía en el cliente ni se le envía el %). Devuelve SOLO el precio
 * final, para no filtrar costo, ganancia ni margen. `costPerKg` lo resuelve la
 * action desde el material (no lo dicta el cliente). Null si el tipo no existe
 * o está inactivo.
 */
export async function quoteFinalPriceByPreset(input: {
  presetId: string;
  grams: number;
  hours: number;
  costPerKg: number;
}): Promise<{ precioFinal: number } | null> {
  const presets = (await repo.listMarginPresets()).map(toPreset);
  const marginPct = selectActiveMargin(presets, input.presetId);
  if (marginPct == null) return null;
  const cfg = await getCalcConfig();
  const q = computeQuote({
    grams: input.grams,
    hours: input.hours,
    costPerKg: input.costPerKg,
    kwhPrice: cfg.kwhPrice,
    machineWatts: cfg.machineWatts,
    machineLifeHours: cfg.machineLifeHours,
    maintenanceCost: cfg.maintenanceCost,
    marginErrorPct: cfg.marginErrorPct,
    marginPct,
  });
  return { precioFinal: q.precioFinal };
}

/**
 * Contexto para el PriceEstimator (calculadora embebida en producto y pedido
 * manual): config de costos, materiales y costo/kg (filamentos), tipos activos
 * y, solo si es admin, los tipos con margen. Una sola función para no repetir el
 * armado en cada página.
 */
/**
 * Filamento elegible en la calculadora: el precio se resuelve por ESTE id.
 * (Fix auditoría 2026-07: antes había un mapa material→costo que colapsaba
 * filamentos del mismo material con distinto precio.)
 */
export type FilamentOption = {
  id: string;
  material: string;
  color: string;
  costPerKg: number;
};

export type EstimatorContext = {
  config: CalcConfig;
  filaments: FilamentOption[];
  presetOptions: MarginPresetOption[];
  presets: MarginPreset[];
  isAdmin: boolean;
};

/**
 * Amortización (costo de producir) desde filamento/material + gramos + horas,
 * en el servidor. Es independiente del tipo/margen: material + electricidad +
 * desgaste + margen de error (computeQuote con margen 0 → costoTotal).
 *
 * Resolución del costo (auditoría 2026-07):
 * - `filamentId` → el costo de ESE filamento (venta manual / calculadora).
 * - solo `material` (productos multicolor) → el costo MÁS CARO del material
 *   (conservador: nunca subestima).
 * - material indicado pero SIN filamento cargado → devuelve 0 para que el
 *   caller RECHACE (antes seguía con costo de material $0 en silencio).
 */
export async function getAmortization(input: {
  filamentId?: string | null;
  material?: string | null;
  grams: number;
  hours: number;
}): Promise<number> {
  const [cfg, filaments] = await Promise.all([
    getCalcConfig(),
    listFilamentsView(),
  ]);
  let costPerKg = 0;
  if (input.filamentId || input.material) {
    const resolved = resolveCostPerKg(filaments, {
      filamentId: input.filamentId ?? null,
      material: input.material ?? null,
    });
    if (resolved == null) return 0; // sin filamento que coincida → rechazar
    costPerKg = resolved;
  }
  const q = computeQuote({
    grams: input.grams,
    hours: input.hours,
    costPerKg,
    kwhPrice: cfg.kwhPrice,
    machineWatts: cfg.machineWatts,
    machineLifeHours: cfg.machineLifeHours,
    maintenanceCost: cfg.maintenanceCost,
    marginErrorPct: cfg.marginErrorPct,
    marginPct: 0,
  });
  return q.costoTotal;
}

export async function getEstimatorContext(): Promise<EstimatorContext> {
  const admin = await isAdmin();
  const [config, rows, presetOptions, presets] = await Promise.all([
    getCalcConfig(),
    listFilamentsView(),
    listActivePresetOptions(),
    admin ? listMarginPresets() : Promise.resolve([] as MarginPreset[]),
  ]);
  // Cada filamento es una opción con SU precio (nada de mapa material→costo,
  // que colapsaba filamentos del mismo material con distinto costo).
  const filaments: FilamentOption[] = rows.map((f) => ({
    id: f.id,
    material: f.material,
    color: f.color,
    costPerKg: f.costPerKg,
  }));
  return { config, filaments, presetOptions, presets, isAdmin: admin };
}

export async function saveCalcConfig(input: CalcConfigInput) {
  return repo.upsertCostConfig({
    kwhPrice: String(input.kwhPrice),
    machineWatts: input.machineWatts,
    machineLifeHours: input.machineLifeHours,
    maintenanceCost: String(input.maintenanceCost),
    marginErrorPct: String(input.marginErrorPct),
  });
}
