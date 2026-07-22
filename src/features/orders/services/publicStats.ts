import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { orders, orderItems, manualSales } from "@/core/db/schema";

// "Hefesto en números" del home: SOLO cuenta lo finalizado (enviado + entregado),
// tanto de pedidos online como de ventas manuales (mostrador). Datos reales, no
// hardcodeados (backlog H26). Si algo falla, el home usa un fallback (safeLoad).
const FINALIZED = ["shipped", "delivered"] as const;

export type HomeStats = { pieces: number; customers: number };

export async function getHomeStats(): Promise<HomeStats> {
  const [onlinePieces, onlineCustomers, manualAgg] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inArray(orders.status, [...FINALIZED])),
    db
      .select({ n: sql<number>`count(distinct ${orders.customerId})::int` })
      .from(orders)
      .where(inArray(orders.status, [...FINALIZED])),
    db
      .select({
        pieces: sql<number>`coalesce(sum(${manualSales.quantity}), 0)::int`,
        customers: sql<number>`count(distinct ${manualSales.customerName})::int`,
      })
      .from(manualSales)
      .where(inArray(manualSales.status, [...FINALIZED])),
  ]);

  const pieces = (onlinePieces[0]?.n ?? 0) + (manualAgg[0]?.pieces ?? 0);
  const customers =
    (onlineCustomers[0]?.n ?? 0) + (manualAgg[0]?.customers ?? 0);
  return { pieces, customers };
}
