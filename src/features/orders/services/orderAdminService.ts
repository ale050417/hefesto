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
import { restoreFilamentForOrder } from "./orderInventory";
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

/**
 * Borra un pedido de forma permanente (hard delete) en CUALQUIER estado
 * (incluye pagados/entregados y pedidos mal creados, duplicados o de prueba).
 * El borrado es transaccional y revierte puntos y usos de cupón
 * (ver repository.deleteOrder). La autorización (solo admin) se valida en la
 * action; acá solo chequeamos que el pedido exista.
 */
export async function deleteOrderAdmin(orderId: string): Promise<void> {
  const order = await findOrderById(orderId);
  if (!order) throw new NotFoundError("No encontramos el pedido.");
  // Reversa de filamento ANTES de borrar (diseño 2026-07): idempotente, así
  // un reintento tras un fallo del borrado no repone dos veces. El ledger no
  // tiene FK al pedido, por eso la reposición sobrevive al hard delete.
  await restoreFilamentForOrder(orderId);
  await deleteOrder(orderId);
}

/**
 * Borra varios pedidos de una (limpieza de pedidos mal creados / de prueba).
 * Ignora los que ya no existen y devuelve cuántos se borraron realmente. Cada
 * pedido se borra en su propia transacción (ver repository.deleteOrder).
 */
export async function deleteOrdersAdmin(orderIds: string[]): Promise<number> {
  let deleted = 0;
  for (const id of orderIds) {
    const order = await findOrderById(id);
    if (!order) continue;
    await restoreFilamentForOrder(id); // reversa de filamento (idempotente)
    await deleteOrder(id);
    deleted += 1;
  }
  return deleted;
}

export async function getOrderStatusCounts() {
  return countOrdersByStatus();
}
