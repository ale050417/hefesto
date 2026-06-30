import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  categories,
  filaments,
  manualSales,
  orderItems,
  orders,
  products,
  profiles,
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

/** KPIs del reporte: facturación, ventas, unidades y clientes nuevos del año. */
export async function getReportKpis(
  year: number,
  database: Database = db,
): Promise<{
  revenue: number;
  salesCount: number;
  unitsSold: number;
  newCustomers: number;
}> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [sales] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, SALES_STATUSES),
        gte(orders.createdAt, yearStart),
        lt(orders.createdAt, yearEnd),
      ),
    );

  const [units] = await database
    .select({ qty: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        inArray(orders.status, SALES_STATUSES),
        gte(orders.createdAt, yearStart),
        lt(orders.createdAt, yearEnd),
      ),
    );

  const [customers] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        eq(profiles.role, "customer"),
        gte(profiles.createdAt, yearStart),
        lt(profiles.createdAt, yearEnd),
      ),
    );

  return {
    revenue: sales?.revenue ?? 0,
    salesCount: sales?.count ?? 0,
    unitsSold: units?.qty ?? 0,
    newCustomers: customers?.count ?? 0,
  };
}

/**
 * Ventas por ORIGEN del año: tienda (orders) vs venta manual (manual_sales).
 * Mismo set de estados "vendido" para ambos. Para el reporte por canal.
 */
export async function getRevenueBySource(
  year: number,
  database: Database = db,
): Promise<{
  storefront: { revenue: number; count: number };
  manual: { revenue: number; count: number };
}> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [store] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, SALES_STATUSES),
        gte(orders.createdAt, yearStart),
        lt(orders.createdAt, yearEnd),
      ),
    );

  const [manual] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(manualSales)
    .where(
      and(
        inArray(manualSales.status, SALES_STATUSES),
        gte(manualSales.saleDate, yearStart),
        lt(manualSales.saleDate, yearEnd),
      ),
    );

  return {
    storefront: { revenue: store?.revenue ?? 0, count: store?.count ?? 0 },
    manual: { revenue: manual?.revenue ?? 0, count: manual?.count ?? 0 },
  };
}

/** Ingresos por mes (1-12) de un año dado. Devuelve array de 12 números. */
export async function getMonthlyRevenue(
  year: number,
  database: Database = db,
): Promise<number[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await database
    .select({
      m: sql<number>`extract(month from ${orders.createdAt})::int`,
      total: sql<number>`coalesce(sum(${orders.total}), 0)::float8`,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, SALES_STATUSES),
        gte(orders.createdAt, yearStart),
        lt(orders.createdAt, yearEnd),
      ),
    )
    .groupBy(sql`1`);
  const out = Array(12).fill(0) as number[];
  for (const r of rows) {
    if (r.m >= 1 && r.m <= 12) out[r.m - 1] = Number(r.total);
  }
  return out;
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
