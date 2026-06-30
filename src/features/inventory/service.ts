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
