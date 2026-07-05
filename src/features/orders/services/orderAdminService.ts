import { NotFoundError, ValidationError } from "@/core/errors";
import {
  countOrdersByStatus,
  deleteOrder,
  findOrderById,
  findOrderDetailForAdmin,
  findOrdersForAdmin,
  updateOrderMeta,
} from "../repository";
import { transitionOrderStatus } from "./orderWorkflow";
import type { OrderListItem, OrderStatus } from "../types";

/**
 * Estados en los que un pedido NUNCA tocó plata real y por eso se puede borrar:
 * quedó pendiente de pago (creado por error / abandonado) o fue cancelado.
 * Un pedido pagado/confirmado en adelante NO se borra: se cancela o reembolsa,
 * porque borrarlo dejaría puntos otorgados huérfanos y alteraría reportes y
 * el reparto de ganancias (Cap. 8, 11).
 */
export const DELETABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "cancelled",
];

export function canDeleteOrder(status: OrderStatus): boolean {
  return DELETABLE_ORDER_STATUSES.includes(status);
}

export async function listOrdersAdmin(opts: {
  status?: OrderStatus;
  page: number;
  pageSize: number;
}): Promise<{
  items: OrderListItem[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const { items, total } = await findOrdersForAdmin(opts);
  return {
    items: items.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer?.fullName ?? null,
      paymentMethod: o.paymentMethod,
      total: Number(o.total),
      status: o.status,
      createdAt: o.createdAt,
    })),
    page: opts.page,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    total,
  };
}

export async function getOrderAdmin(id: string) {
  return findOrderDetailForAdmin(id);
}

/** Guarda el código de seguimiento / nota interna. */
export async function setOrderMeta(
  orderId: string,
  fields: { trackingCode?: string | null; internalNote?: string | null },
) {
  return updateOrderMeta(orderId, fields);
}

/**
 * Cambia el estado validando la máquina de estados y la regla de negocio:
 * para marcar "enviado" el pedido debe tener código de seguimiento (Cap. 11).
 */
export async function transitionOrder(
  orderId: string,
  toStatus: OrderStatus,
  opts: { changedBy?: string | null; note?: string | null } = {},
) {
  if (toStatus === "shipped") {
    const order = await findOrderById(orderId);
    if (!order) throw new NotFoundError("No encontramos el pedido.");
    if (!order.trackingCode) {
      throw new ValidationError(
        "Cargá el código de seguimiento antes de marcar el pedido como enviado.",
      );
    }
  }
  return transitionOrderStatus(orderId, toStatus, opts);
}

/**
 * Borra un pedido creado por error. Regla de negocio (validada en el servidor):
 * solo se puede borrar si nunca tocó plata (ver DELETABLE_ORDER_STATUSES). La
 * autorización (solo admin) se hace en la action.
 */
export async function deleteOrderAdmin(orderId: string): Promise<void> {
  const order = await findOrderById(orderId);
  if (!order) throw new NotFoundError("No encontramos el pedido.");
  if (!canDeleteOrder(order.status)) {
    throw new ValidationError(
      "Solo se pueden eliminar pedidos pendientes de pago o cancelados. " +
        "Cancelá el pedido antes de eliminarlo.",
    );
  }
  await deleteOrder(orderId);
}

export async function getOrderStatusCounts() {
  return countOrdersByStatus();
}
