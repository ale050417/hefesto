import { NotFoundError, ValidationError } from "@/core/errors";
import {
  countOrdersByStatus,
  findOrderById,
  findOrderDetailForAdmin,
  findOrdersForAdmin,
  updateOrderMeta,
} from "../repository";
import { transitionOrderStatus } from "./orderWorkflow";
import type { OrderListItem, OrderStatus } from "../types";

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

export async function getOrderStatusCounts() {
  return countOrdersByStatus();
}
