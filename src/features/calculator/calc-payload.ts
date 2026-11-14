// Payload de la Calculadora 3D para la app móvil (2026-10-31). Puro, sin I/O.
//
// Regla de seguridad del negocio: el MARGEN vive en el servidor. El operador
// recibe solo nombres de tipos y el precio final; el % de margen, el costo
// total y la ganancia viajan únicamente al admin (la web hace lo mismo: el
// operador no ve métricas que revelen ganancia o facturación).

import type { QuoteResult } from "./calculator";
import type { CalcConfig, MarginPreset, MarginPresetOption } from "./service";

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type CalcHistoryInput = {
  id: string;
  name: string;
  customer: string | null;
  material: string | null;
  color: string | null;
  grams: string | number;
  hours: string | number;
  costPerKg: string | number;
  marginPct: string | number;
  costoTotal: string | number;
  ganancia: string | number;
  precioFinal: string | number;
  notes: string | null;
  createdAt: Date;
};

/** Fila del historial. Los campos que revelan margen/ganancia, solo admin. */
export function historyRowToJson(r: CalcHistoryInput, isAdmin: boolean) {
  return {
    id: r.id,
    name: r.name,
    customer: r.customer,
    material: r.material,
    color: r.color,
    grams: num(r.grams),
    hours: num(r.hours),
    precioFinal: num(r.precioFinal),
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    ...(isAdmin
      ? {
          costPerKg: num(r.costPerKg),
          marginPct: num(r.marginPct),
          costoTotal: num(r.costoTotal),
          ganancia: num(r.ganancia),
        }
      : {}),
  };
}

export type CalcStatsInput = {
  count: number;
  grams: number;
  hours: number;
  ganancia: number;
  precioFinal: number;
};

/** Estadísticas del historial. Ganancia y facturación estimada, solo admin. */
export function statsToJson(s: CalcStatsInput, isAdmin: boolean) {
  return {
    count: num(s.count),
    grams: num(s.grams),
    hours: num(s.hours),
    ...(isAdmin
      ? { ganancia: num(s.ganancia), precioFinal: num(s.precioFinal) }
      : {}),
  };
}

export function buildCalcPayload(p: {
  config: CalcConfig;
  filaments: Array<{
    id: string;
    material: string;
    color: string;
    brand: string;
    costPerKg: number;
    hex?: string | null;
  }>;
  presetOptions: MarginPresetOption[];
  presets: MarginPreset[];
  history: CalcHistoryInput[];
  stats: CalcStatsInput;
  isAdmin: boolean;
}) {
  const { isAdmin } = p;
  return {
    isAdmin,
    config: {
      kwhPrice: num(p.config.kwhPrice),
      machineWatts: num(p.config.machineWatts),
      machineLifeHours: num(p.config.machineLifeHours),
      maintenanceCost: num(p.config.maintenanceCost),
      marginErrorPct: num(p.config.marginErrorPct),
    },
    filaments: p.filaments.map((f) => ({
      id: f.id,
      material: f.material,
      color: f.color,
      brand: f.brand,
      costPerKg: num(f.costPerKg),
      hex: f.hex ?? null,
    })),
    // Operador: solo id + nombre de los tipos ACTIVOS (sin margen).
    presetOptions: p.presetOptions.map((o) => ({ id: o.id, name: o.name })),
    // Admin: todos los tipos con su margen. Operador: lista vacía.
    presets: isAdmin
      ? p.presets.map((t) => ({
          id: t.id,
          name: t.name,
          marginPct: num(t.marginPct),
          active: t.active,
          sortOrder: num(t.sortOrder),
        }))
      : [],
    history: p.history.map((h) => historyRowToJson(h, isAdmin)),
    stats: statsToJson(p.stats, isAdmin),
  };
}

/** Desglose completo de una cotización (admin). */
export function breakdownToJson(
  quote: QuoteResult,
  marginPct: number,
  costPerKg: number,
) {
  return {
    material: quote.material,
    electricidad: quote.electricidad,
    desgaste: quote.desgaste,
    subtotal: quote.subtotal,
    margenError: quote.margenError,
    costoTotal: quote.costoTotal,
    ganancia: quote.ganancia,
    precioFinal: quote.precioFinal,
    hours: quote.hours,
    marginPct,
    costPerKg,
  };
}
