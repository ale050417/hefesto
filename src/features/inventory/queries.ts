import * as repo from "./repository";
import { isLowStock, registerFailure } from "./service";
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
      stockGrams: stock,
      alertThresholdGrams: threshold,
      lowStock: isLowStock(stock, threshold),
    };
  });
}

export async function getFilament(id: string): Promise<Filament | null> {
  return repo.findFilamentById(id);
}

export async function addFilament(input: FilamentInput): Promise<Filament> {
  return repo.insertFilament({
    material: input.material,
    color: input.color,
    stockGrams: String(input.stockGrams),
    alertThresholdGrams: String(input.alertThresholdGrams),
  });
}

export async function updateFilament(
  id: string,
  input: FilamentInput,
): Promise<Filament> {
  return repo.updateFilamentRow(id, {
    material: input.material,
    color: input.color,
    stockGrams: String(input.stockGrams),
    alertThresholdGrams: String(input.alertThresholdGrams),
  });
}

export async function listFailures(): Promise<PrintFailure[]> {
  return repo.listFailures();
}

export async function recordFailure(
  input: FailureInput,
): Promise<{ lowStock: boolean }> {
  return registerFailure(
    {
      filamentId: input.filamentId,
      pieceName: input.pieceName,
      gramsLost: input.gramsLost,
      reason: input.reason,
      notes: input.notes ?? null,
      deducted: input.deducted ?? true,
    },
    {
      getFilament: repo.findFilamentById,
      persist: (p) => repo.registerFailureTx(p),
    },
  );
}
