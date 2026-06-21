import { NotFoundError } from "@/core/errors";
import type { Filament } from "./types";

// --- Lógica pura (testeable) ---

/** Nuevo stock tras una falla: nunca baja de 0. */
export function computeNewStock(current: number, gramsLost: number): number {
  return Math.max(0, current - gramsLost);
}

/** ¿Está en o por debajo del umbral de alerta? */
export function isLowStock(stockGrams: number, threshold: number): boolean {
  return stockGrams <= threshold;
}

// --- registerFailure con dependencias inyectables (tests puros) ---

export type RegisterFailureParams = {
  filamentId: string;
  pieceName: string;
  gramsLost: number;
  reason: string;
  notes?: string | null;
  deducted: boolean;
};

export type RegisterFailureDeps = {
  getFilament: (id: string) => Promise<Filament | null>;
  persist: (params: {
    failure: {
      filamentId: string;
      pieceName: string;
      material: string;
      color: string;
      gramsLost: number;
      reason: string;
      notes: string | null;
      deducted: boolean;
    };
    stockUpdate?: { filamentId: string; newStock: number };
  }) => Promise<void>;
};

/**
 * Registra una falla. Si `deducted`, descuenta los gramos del filamento (sin
 * bajar de 0) y avisa si quedó bajo el umbral. Snapshot de material/color.
 */
export async function registerFailure(
  params: RegisterFailureParams,
  deps: RegisterFailureDeps,
): Promise<{ lowStock: boolean }> {
  const filament = await deps.getFilament(params.filamentId);
  if (!filament) throw new NotFoundError("No encontramos el filamento.");

  let stockUpdate: { filamentId: string; newStock: number } | undefined;
  let lowStock = false;

  if (params.deducted) {
    const newStock = computeNewStock(
      Number(filament.stockGrams),
      params.gramsLost,
    );
    stockUpdate = { filamentId: filament.id, newStock };
    lowStock = isLowStock(newStock, Number(filament.alertThresholdGrams));
  }

  await deps.persist({
    failure: {
      filamentId: filament.id,
      pieceName: params.pieceName,
      material: filament.material,
      color: filament.color,
      gramsLost: params.gramsLost,
      reason: params.reason,
      notes: params.notes ?? null,
      deducted: params.deducted,
    },
    ...(stockUpdate ? { stockUpdate } : {}),
  });

  return { lowStock };
}
