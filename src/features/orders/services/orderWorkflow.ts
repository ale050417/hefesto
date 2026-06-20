import { InvalidTransitionError, NotFoundError } from "@/core/errors";
import type { Order, OrderStatus } from "../types";

// Máquina de estados del pedido (Cap. 2.5 / 11). Define qué transiciones son
// válidas; cancelled y refunded son terminales.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled", "refunded"],
  in_production: ["ready", "cancelled", "refunded"],
  ready: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

// Dependencias inyectables (tests puros, sin DB).
export type TransitionDeps = {
  getOrder: (id: string) => Promise<Pick<Order, "id" | "status"> | null>;
  persist: (params: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    changedBy: string | null;
    note: string | null;
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
  });
}
