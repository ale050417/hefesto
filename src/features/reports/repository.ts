import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  categories,
  filaments,
  orderItems,
  orders,
  products,
} from "@/core/db/schema";
import type { OrderStatus } from "@/features/orders/types";

type Database = typeof db;

// Estados que cuentan como venta concretada (no pendiente / cancelada).
export const SALES_STATUSES: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

export async function getKpiRows(database: Database = db) {
  const [sales] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(inArray(orders.status, SALES_STATUSES));

  const [pending] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(eq(orders.status, "pending_payment"));

  const [lowStock] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(filaments)
    .where(sql`${filaments.stockGrams} <= ${filaments.alertThresholdGrams}`);

  return {
    revenue: sales?.revenue ?? 0,
    salesCount: sales?.count ?? 0,
    pendingCount: pending?.count ?? 0,
    lowStockCount: lowStock?.count ?? 0,
  };
}

export async function getRevenueByDay(
  since: Date,
  database: Database = db,
): Promise<Array<{ day: string; total: number }>> {
  return database
    .select({
      day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)::float8`,
    })
    .from(orders)
    .where(
      and(inArray(orders.status, SALES_STATUSES), gte(orders.createdAt, since)),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

export async function getTopProducts(
  limit: number,
  database: Database = db,
): Promise<Array<{ name: string; qty: number; revenue: number }>> {
  return database
    .select({
      name: orderItems.productName,
      qty: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)::float8`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, SALES_STATUSES))
    .groupBy(orderItems.productName)
    .orderBy(desc(sql`coalesce(sum(${orderItems.lineTotal}), 0)`))
    .limit(limit);
}

export async function getCategoryBreakdown(
  database: Database = db,
): Promise<Array<{ name: string; revenue: number }>> {
  return database
    .select({
      name: categories.name,
      revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)::float8`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(inArray(orders.status, SALES_STATUSES))
    .groupBy(categories.name)
    .orderBy(desc(sql`coalesce(sum(${orderItems.lineTotal}), 0)`));
}

export async function getSalesForCsv(
  from: Date,
  to: Date,
  database: Database = db,
): Promise<
  Array<{
    orderNumber: string;
    status: OrderStatus;
    total: string;
    createdAt: Date;
  }>
> {
  return database
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, from), lte(orders.createdAt, to)))
    .orderBy(desc(orders.createdAt));
}
