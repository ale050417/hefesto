import { InvalidTransitionError, NotFoundError } from "@/core/errors";
import { canTransition } from "../transitions";
import type { Order, OrderStatus } from "../types";

export { ORDER_TRANSITIONS, canTransition } from "../transitions";

// Dependencias inyectables (tests puros, sin DB).
export type TransitionDeps = {
  getOrder: (id: string) => Promise<Pick<Order, "id" | "status"> | null>;
  persist: (params: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    changedBy: string | null;
    note: string | null;
    paidAt?: Date;
  }) => Promise<Order>;
};

const defaultDeps: TransitionDeps = {
  getOrder: (id) => import("../repository").then((m) => m.findOrderById(id)),
  persist: (params) =>
    import("../repository").then((m) => m.updateOrderStatus(params)),
};

/**
 * Cambia el estado de un pedido respetando la máquina de estados. Registra la
 * transición en el historial (vía repository). Lanza InvalidTransitionError si
 * la transición no es válida.
 */
export async function transitionOrderStatus(
  orderId: string,
  toStatus: OrderStatus,
  opts: { changedBy?: string | null; note?: string | null } = {},
  deps: TransitionDeps = defaultDeps,
): Promise<Order> {
  const order = await deps.getOrder(orderId);
  if (!order) throw new NotFoundError("No encontramos el pedido.");

  if (!canTransition(order.status, toStatus)) {
    throw new InvalidTransitionError(
      `No se puede pasar de "${order.status}" a "${toStatus}".`,
    );
  }

  return deps.persist({
    orderId: order.id,
    fromStatus: order.status,
    toStatus,
    changedBy: opts.changedBy ?? null,
    note: opts.note ?? null,
    // Confirmar = pago acreditado (Cap. 11: pending→confirmed marca paid_at).
    // El webhook de MP lo setea por su lado; esto cubre la confirmación
    // manual (transferencia/efectivo). Auditoría 2026-07, hallazgo I2.
    ...(toStatus === "confirmed" ? { paidAt: new Date() } : {}),
  });
}
