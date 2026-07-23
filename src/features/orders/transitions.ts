import type { OrderStatus } from "./types";

// Máquina de estados del pedido (Cap. 2.5 / 11). Módulo PURO (sin DB) para que
// también lo pueda usar la UI cliente. cancelled y refunded son terminales.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled", "refunded"],
  in_production: ["ready", "cancelled", "refunded"],
  // "delivered" directo desde "ready": retiro en el taller (sin envío).
  ready: ["shipped", "delivered", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  // Desde entregado se puede reembolsar o cancelar (devolución post-entrega).
  delivered: ["cancelled", "refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
