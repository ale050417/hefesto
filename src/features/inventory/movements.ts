import type { FilamentMovementReason } from "./types";

/**
 * Historial de movimientos de filamento para la app (2026-10-31). Puro: arma el
 * texto legible de cada movimiento del ledger a partir de su motivo y del
 * origen (pedido / venta manual / falla) que trae el JOIN del repository.
 */

export const MOVEMENT_REASON_LABEL: Record<FilamentMovementReason, string> = {
  order: "Pedido online",
  manual_sale: "Venta manual",
  failure: "Impresión fallida",
  adjust: "Ajuste de stock",
  restore: "Stock repuesto (anulación)",
};

export type MovementRow = {
  id: string;
  filamentId: string | null;
  material: string;
  color: string;
  deltaGrams: string | number;
  reason: string;
  refId: string | null;
  createdAt: Date;
  /** Del JOIN con el origen (todos opcionales: el origen puede estar borrado). */
  orderNumber?: string | null;
  saleCustomer?: string | null;
  pieceName?: string | null;
};

export type MovementView = {
  id: string;
  filamentId: string | null;
  material: string;
  color: string;
  /** Con signo: negativo = consumo, positivo = reposición. */
  deltaGrams: number;
  reason: string;
  reasonLabel: string;
  /** Detalle del origen ("HF-0042", "Cliente", "Lámpara"). null si no hay. */
  ref: string | null;
  createdAt: string;
};

/** Texto del origen del movimiento, o null si no se puede identificar. */
export function movementRef(m: MovementRow): string | null {
  const order = m.orderNumber?.trim();
  const customer = m.saleCustomer?.trim();
  const piece = m.pieceName?.trim();
  switch (m.reason) {
    case "order":
      return order || null;
    case "manual_sale":
      return customer || null;
    case "failure":
      return piece || null;
    case "restore":
      // La reposición es de un pedido o de una venta manual: lo que exista.
      return order || customer || null;
    default:
      return null;
  }
}

export function toMovementView(m: MovementRow): MovementView {
  const reason = m.reason as FilamentMovementReason;
  return {
    id: m.id,
    filamentId: m.filamentId,
    material: m.material,
    color: m.color,
    deltaGrams: Number(m.deltaGrams),
    reason: m.reason,
    reasonLabel: MOVEMENT_REASON_LABEL[reason] ?? m.reason,
    ref: movementRef(m),
    createdAt: m.createdAt.toISOString(),
  };
}
