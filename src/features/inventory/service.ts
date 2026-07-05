import { NotFoundError } from "@/core/errors";
import type { Filament, PrintFailure } from "./types";

// --- Lógica pura (testeable) ---

/** Nuevo stock tras una falla: nunca baja de 0. */
export function computeNewStock(current: number, gramsLost: number): number {
  return Math.max(0, current - gramsLost);
}

/** ¿Está en o por debajo del umbral de alerta? */
export function isLowStock(stockGrams: number, threshold: number): boolean {
  return stockGrams <= threshold;
}

export type FilamentStatus = "ok" | "bajo" | "agotado";

/** Estado de stock de 3 niveles (como el index): agotado / bajo / ok. */
export function filamentStatus(
  stockGrams: number,
  threshold: number,
): FilamentStatus {
  if (stockGrams <= 0) return "agotado";
  if (stockGrams <= threshold) return "bajo";
  return "ok";
}

// --- registerFailure con dependencias inyectables (tests puros) ---

export type RegisterFailureParams = {
  pieceName: string;
  material: string;
  color: string;
  gramsLost: number;
  reason: string;
  notes?: string | null;
  deducted: boolean;
};

export type RegisterFailureDeps = {
  // Busca el filamento que coincide con material+color (para descontar).
  findFilament: (material: string, color: string) => Promise<Filament | null>;
  persist: (params: {
    failure: {
      filamentId: string | null;
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
 * Registra una falla (como el index: se elige material+color). Si `deducted` y
 * existe un filamento de ese material/color, descuenta los gramos (sin bajar de
 * 0) y avisa si quedó bajo el umbral. Si no hay match, igual queda registrada
 * (con snapshot de material/color) pero sin descontar.
 */
export async function registerFailure(
  params: RegisterFailureParams,
  deps: RegisterFailureDeps,
): Promise<{ lowStock: boolean; deducted: boolean }> {
  const filament = params.deducted
    ? await deps.findFilament(params.material, params.color)
    : null;

  let stockUpdate: { filamentId: string; newStock: number } | undefined;
  let lowStock = false;
  let deducted = false;

  if (params.deducted && filament) {
    const newStock = computeNewStock(
      Number(filament.stockGrams),
      params.gramsLost,
    );
    stockUpdate = { filamentId: filament.id, newStock };
    lowStock = isLowStock(newStock, Number(filament.alertThresholdGrams));
    deducted = true;
  }

  await deps.persist({
    failure: {
      filamentId: filament?.id ?? null,
      pieceName: params.pieceName,
      material: params.material,
      color: params.color,
      gramsLost: params.gramsLost,
      reason: params.reason,
      notes: params.notes ?? null,
      deducted,
    },
    ...(stockUpdate ? { stockUpdate } : {}),
  });

  return { lowStock, deducted };
}

// --- deleteFailure: devuelve al stock los gramos descontados ---

/** Stock tras DEVOLVER gramos al inventario (inverso de computeNewStock). */
export function restoreStock(current: number, grams: number): number {
  return current + grams;
}

export type DeleteFailureDeps = {
  findFailure: (id: string) => Promise<PrintFailure | null>;
  findFilamentById: (id: string) => Promise<Filament | null>;
  persist: (params: {
    failureId: string;
    stockUpdate?: { filamentId: string; newStock: number };
  }) => Promise<void>;
};

/**
 * Borra una falla y DEVUELVE al stock los gramos que había descontado (decisión
 * de Ale: el inventario siempre refleja la realidad). Solo repone si la falla
 * había descontado (`deducted`) y el filamento todavía existe; si no, borra sin
 * tocar stock. Devuelve cuántos gramos se repusieron (0 si no hubo reposición).
 */
export async function deleteFailure(
  id: string,
  deps: DeleteFailureDeps,
): Promise<{ restored: number }> {
  const failure = await deps.findFailure(id);
  if (!failure) throw new NotFoundError("No encontramos la falla.");

  let stockUpdate: { filamentId: string; newStock: number } | undefined;
  let restored = 0;

  if (failure.deducted && failure.filamentId) {
    const filament = await deps.findFilamentById(failure.filamentId);
    if (filament) {
      const grams = Number(failure.gramsLost);
      stockUpdate = {
        filamentId: filament.id,
        newStock: restoreStock(Number(filament.stockGrams), grams),
      };
      restored = grams;
    }
  }

  await deps.persist({
    failureId: id,
    ...(stockUpdate ? { stockUpdate } : {}),
  });
  return { restored };
}
