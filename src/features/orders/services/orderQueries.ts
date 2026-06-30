import { findOrderDetailByNumber, findOrdersByCustomer } from "../repository";
import type { OrderWithItems } from "../types";

/**
 * Pedido para el cliente: solo lo devuelve si es el dueño (Cap. 13, "cada uno
 * ve solo lo suyo"). Si no existe o no es suyo, devuelve null.
 */
export async function getOrderForCustomer(
  orderNumber: string,
  customerId: string,
): Promise<OrderWithItems | null> {
  const order = await findOrderDetailByNumber(orderNumber);
  if (!order || order.customerId !== customerId) return null;
  return order;
}

export type MyOrderListItem = {
  orderNumber: string;
  status: OrderWithItems["status"];
  paymentMethod: OrderWithItems["paymentMethod"];
  total: number;
  createdAt: Date;
  /** Nombre del primer producto (para que el cliente reconozca el pedido). */
  title: string;
  /** Cantidad de productos adicionales además del primero. */
  moreCount: number;
  /** Total de unidades del pedido. */
  units: number;
};

/** Lista de pedidos del cliente (para "Mis pedidos"). */
export async function getMyOrders(
  customerId: string,
): Promise<MyOrderListItem[]> {
  const orders = await findOrdersByCustomer(customerId);
  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    status: o.status,
    paymentMethod: o.paymentMethod,
    total: Number(o.total),
    createdAt: o.createdAt,
    title: o.items[0]?.productName ?? o.orderNumber,
    moreCount: Math.max(0, o.items.length - 1),
    units: o.items.reduce((a, it) => a + it.quantity, 0),
  }));
}
