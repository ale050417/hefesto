import { NotFoundError } from "@/core/errors";
import type {
  Filament,
  FilamentMovementReason,
  NewFilamentMovement,
  PrintFailure,
} from "./types";

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

// --- Ledger de movimientos: ventas descuentan filamento (diseño 2026-07) ---

/**
 * GREATEST(stock + delta, 0): el stock nunca baja de 0 y se devuelve el delta
 * REAL aplicado (pedía -80 con 50 en stock → newStock 0, appliedDelta -50).
 * Pura y testeable; el repository aplica la misma regla dentro de la tx.
 */
export function applyCappedDelta(
  current: number,
  delta: number,
): { newStock: number; appliedDelta: number } {
  const newStock = Math.max(0, current + delta);
  return { newStock, appliedDelta: newStock - current };
}

type FilamentMatch = Pick<Filament, "id" | "material" | "color">;

/**
 * Filamento que consume una línea de pedido online. El color elegido viaja en
 * el snapshot `variantLabel` ("Rojo" o "Talle M · Rojo"); el material sale del
 * producto. Matching insensible a mayúsculas; los segmentos del label se
 * prueban del final al principio porque el color se agrega último. Pura y
 * testeable (Cap. 15). Si no hay match, el hook NO bloquea la venta: registra
 * warning en auditoría.
 */
export function resolveFilamentForItem<T extends FilamentMatch>(
  filaments: T[],
  params: { material: string | null; variantLabel: string | null },
): T | null {
  const material = params.material?.trim().toLowerCase();
  const label = params.variantLabel?.trim();
  if (!material || !label) return null;

  const byMaterial = filaments.filter(
    (f) => f.material.trim().toLowerCase() === material,
  );
  if (byMaterial.length === 0) return null;

  const segments = label
    .split("·")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const hit = byMaterial.find(
      (f) => f.color.trim().toLowerCase() === segments[i],
    );
    if (hit) return hit;
  }
  return null;
}

/**
 * Filamento que consume una venta manual: por id si se eligió uno; si no, por
 * material SOLO cuando hay un único filamento de ese material (si hay varios
 * no se adivina: se saltea con warning). Pura y testeable.
 */
export function resolveFilamentForManualSale<T extends FilamentMatch>(
  filaments: T[],
  params: { filamentId?: string | null; material?: string | null },
): T | null {
  if (params.filamentId) {
    return filaments.find((f) => f.id === params.filamentId) ?? null;
  }
  const material = params.material?.trim().toLowerCase();
  if (!material) return null;
  const matches = filaments.filter(
    (f) => f.material.trim().toLowerCase() === material,
  );
  return matches.length === 1 ? matches[0]! : null;
}

// Puerta única del ledger para otros features (orders importa ESTE service,
// nunca el repository de inventory — regla de dependencias, Cap. 5/19).

/** ¿Este pedido/venta ya descontó? (idempotencia del hook) */
export async function hasFilamentMovements(
  reason: FilamentMovementReason,
  refId: string,
): Promise<boolean> {
  const repo = await import("./repository");
  return repo.existsMovementByRef(reason, refId);
}

/** Lista de filamentos para matching (id + material + color + stock). */
export async function listFilamentsForMatching(): Promise<Filament[]> {
  const repo = await import("./repository");
  return repo.listFilaments();
}

/** Aplica descuentos/reposiciones y registra los movimientos (una tx). */
export async function applyFilamentDeltas(
  movements: NewFilamentMovement[],
): Promise<void> {
  const repo = await import("./repository");
  return repo.applyFilamentDeltasTx(movements);
}

/**
 * Repone lo que un pedido/venta había descontado (compensatorio 'restore').
 * Idempotente. Devuelve los gramos devueltos al stock.
 */
export async function restoreFilamentMovements(
  reason: FilamentMovementReason,
  refId: string,
): Promise<number> {
  const repo = await import("./repository");
  return repo.restoreMovementsByRefTx(reason, refId);
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
