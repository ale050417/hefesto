import { findOrderDetailByNumber } from "../repository";
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
