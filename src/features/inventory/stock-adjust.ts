import { NotFoundError, ValidationError } from "@/core/errors";
import type { Filament, LowStockFilament, NewFilamentMovement } from "./types";

/**
 * Ajuste MANUAL de stock de un carrete (app móvil, 2026-10-31). A diferencia de
 * "sumar carrete" de la web (que escribe el stock sin dejar rastro), el ajuste
 * pasa por el ledger (`filament_movements`, reason 'adjust'): cada cambio queda
 * en el historial del carrete con su delta y su fecha, y el motivo en auditoría.
 *
 * Regla: un ajuste manual NO deja el stock en negativo (el negativo es "deuda"
 * por sobreventa y solo lo generan las ventas/fallas; la web tampoco deja
 * cargar un stock negativo a mano).
 */

/** Gramos con 2 decimales (la columna es numeric(10,2)). */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type StockAdjustPlan = { deltaGrams: number; newStock: number };

/**
 * Pura y testeable: del stock actual y lo pedido (delta con signo o stock
 * contado) saca el delta a aplicar y el stock resultante, o lanza
 * `ValidationError` con el mensaje para mostrar.
 */
export function planStockAdjust(
  current: number,
  input: { deltaGrams?: number; newStockGrams?: number },
): StockAdjustPlan {
  let delta: number;
  if (input.newStockGrams !== undefined) {
    if (!Number.isFinite(input.newStockGrams) || input.newStockGrams < 0) {
      throw new ValidationError("El stock no puede ser negativo.");
    }
    delta = r2(input.newStockGrams - current);
    if (delta === 0) {
      throw new ValidationError(`El stock ya es de ${r2(current)} g.`);
    }
  } else {
    const d = input.deltaGrams;
    if (d === undefined || !Number.isFinite(d)) {
      throw new ValidationError("Indicá cuántos gramos sumar o restar.");
    }
    delta = r2(d);
    if (delta === 0) {
      throw new ValidationError("Indicá cuántos gramos sumar o restar.");
    }
  }

  const newStock = r2(current + delta);
  if (newStock < 0) {
    throw new ValidationError(
      current > 0
        ? `No podés restar ${Math.abs(delta)} g: solo hay ${r2(current)} g en stock.`
        : "No hay stock para restar.",
    );
  }
  return { deltaGrams: delta, newStock };
}

export type AdjustStockDeps = {
  findFilament: (id: string) => Promise<Filament | null>;
  applyDeltas: (
    movements: NewFilamentMovement[],
  ) => Promise<LowStockFilament[]>;
  /** Aviso al panel si quedó bajo el umbral (best-effort). */
  notifyLow: (items: LowStockFilament[]) => Promise<void>;
  audit: (entry: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }) => Promise<void>;
};

export type AdjustStockResult = {
  deltaGrams: number;
  previousStock: number;
  newStock: number;
  /** Quedó en/bajo el umbral de alerta tras una baja. */
  lowStock: boolean;
};

/**
 * Aplica el ajuste: valida contra el stock actual, lo mueve por el ledger (una
 * transacción con el carrete bloqueado), avisa si quedó bajo y audita. Las
 * dependencias son inyectables para testear sin base (patrón de service.ts).
 */
export async function adjustFilamentStock(
  params: {
    id: string;
    input: { deltaGrams?: number; newStockGrams?: number };
    reason?: string | null;
    actorId: string | null;
  },
  deps: AdjustStockDeps,
): Promise<AdjustStockResult> {
  const f = await deps.findFilament(params.id);
  if (!f) throw new NotFoundError("No encontramos el filamento.");

  const previousStock = Number(f.stockGrams);
  const plan = planStockAdjust(previousStock, params.input);

  const low = await deps.applyDeltas([
    {
      filamentId: f.id,
      material: f.material,
      color: f.color,
      deltaGrams: plan.deltaGrams,
      reason: "adjust",
      refId: null,
    },
  ]);
  if (low.length > 0) {
    await deps.notifyLow(low).catch(() => undefined);
  }

  const reason = params.reason?.trim() || null;
  await deps.audit({
    actorId: params.actorId,
    action: "inventory.stock_adjusted",
    entityType: "filament",
    entityId: f.id,
    metadata: {
      material: f.material,
      color: f.color,
      deltaGrams: plan.deltaGrams,
      previousStock,
      newStock: plan.newStock,
      ...(reason ? { reason } : {}),
    },
  });

  return {
    deltaGrams: plan.deltaGrams,
    previousStock,
    newStock: plan.newStock,
    lowStock: low.length > 0,
  };
}
