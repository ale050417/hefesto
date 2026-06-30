import * as repo from "./repository";
import { computeQuote } from "./calculator";
import type { CalcConfigInput, CalcSaveInput } from "./schemas";

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

export async function createCalc(input: CalcSaveInput, userId: string | null) {
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
    marginPct: input.marginPct,
  });
  return repo.insertCalcHistory({
    name: input.name,
    customer: input.customer ?? null,
    material: input.material ?? null,
    color: input.color ?? null,
    grams: String(input.grams),
    hours: String(input.hours),
    costPerKg: String(input.costPerKg),
    marginPct: String(input.marginPct),
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

export async function saveCalcConfig(input: CalcConfigInput) {
  return repo.upsertCostConfig({
    kwhPrice: String(input.kwhPrice),
    machineWatts: input.machineWatts,
    machineLifeHours: input.machineLifeHours,
    maintenanceCost: String(input.maintenanceCost),
    marginErrorPct: String(input.marginErrorPct),
  });
}
