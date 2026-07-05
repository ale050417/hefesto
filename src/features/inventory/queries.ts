import { NotFoundError } from "@/core/errors";
import * as repo from "./repository";
import {
  deleteFailure as runDeleteFailure,
  filamentStatus,
  isLowStock,
  registerFailure,
} from "./service";
import type { FailureInput, FilamentInput } from "./schemas";
import type { Filament, FilamentView, PrintFailure } from "./types";

export async function listFilamentsView(): Promise<FilamentView[]> {
  const rows = await repo.listFilaments();
  return rows.map((f) => {
    const stock = Number(f.stockGrams);
    const threshold = Number(f.alertThresholdGrams);
    return {
      id: f.id,
      material: f.material,
      color: f.color,
      brand: f.brand,
      diameter: f.diameter,
      stockGrams: stock,
      spoolGrams: Number(f.spoolGrams),
      costPerKg: Number(f.costPerKg),
      alertThresholdGrams: threshold,
      lowStock: isLowStock(stock, threshold),
      status: filamentStatus(stock, threshold),
    };
  });
}

export async function getFilament(id: string): Promise<Filament | null> {
  return repo.findFilamentById(id);
}

function toRow(input: FilamentInput) {
  return {
    material: input.material,
    color: input.color,
    brand: input.brand,
    diameter: input.diameter,
    stockGrams: String(input.stockGrams),
    spoolGrams: String(input.spoolGrams),
    costPerKg: String(input.costPerKg),
    alertThresholdGrams: String(input.alertThresholdGrams),
  };
}

export async function addFilament(input: FilamentInput): Promise<Filament> {
  return repo.insertFilament(toRow(input));
}

export async function updateFilament(
  id: string,
  input: FilamentInput,
): Promise<Filament> {
  return repo.updateFilamentRow(id, toRow(input));
}

/** Suma un carrete (spoolGrams) al stock actual. */
export async function addSpool(id: string): Promise<Filament> {
  const f = await repo.findFilamentById(id);
  if (!f) throw new NotFoundError("No encontramos el filamento.");
  const newStock = Number(f.stockGrams) + Number(f.spoolGrams);
  return repo.updateFilamentRow(id, { stockGrams: String(newStock) });
}

export async function deleteFilament(id: string): Promise<void> {
  await repo.deleteFilamentRow(id);
}

export async function listFailures(): Promise<PrintFailure[]> {
  return repo.listFailures();
}

export async function recordFailure(
  input: FailureInput,
): Promise<{ lowStock: boolean; deducted: boolean }> {
  return registerFailure(
    {
      pieceName: input.pieceName,
      material: input.material,
      color: input.color,
      gramsLost: input.gramsLost,
      reason: input.reason,
      notes: input.notes ?? null,
      deducted: input.deducted ?? true,
    },
    {
      findFilament: repo.findFilamentByMaterialColor,
      persist: (p) => repo.registerFailureTx(p),
    },
  );
}

export async function updateFailure(
  id: string,
  input: FailureInput,
): Promise<PrintFailure> {
  return repo.updateFailureRow(id, {
    pieceName: input.pieceName,
    material: input.material,
    color: input.color,
    gramsLost: String(input.gramsLost),
    reason: input.reason,
    notes: input.notes ?? null,
  });
}

export async function deleteFailure(id: string): Promise<{ restored: number }> {
  return runDeleteFailure(id, {
    findFailure: repo.findFailureById,
    findFilamentById: repo.findFilamentById,
    persist: (p) => repo.deleteFailureTx(p),
  });
}
