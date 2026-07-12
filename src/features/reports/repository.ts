import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  categories,
  filamentMovements,
  filaments,
  manualSales,
  orderItems,
  orders,
  printFailures,
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
        // El personal con rol de equipo no cuenta como cliente nuevo.
        isNull(profiles.roleId),
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

/** Facturacion por categoria de las VENTAS MANUALES (snapshot de nombre). Sin
 * categoria -> "Sin categoria". Se combina con la de tienda en el service. */
export async function getManualCategoryBreakdown(
  database: Database = db,
): Promise<Array<{ name: string; revenue: number }>> {
  const label = sql<string>`coalesce(nullif(${manualSales.category}, ''), 'Sin categoria')`;
  return database
    .select({
      name: label,
      revenue: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
    })
    .from(manualSales)
    .where(inArray(manualSales.status, SALES_STATUSES))
    .groupBy(label)
    .orderBy(desc(sql`coalesce(sum(${manualSales.total}), 0)`));
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

// ---------------------------------------------------------------------------
// Ventas manuales en el pipeline de métricas (Fase 5 del plan integral).
// Mismo criterio de estados que la tienda (SALES_STATUSES) para que una venta
// manual "cuente" exactamente igual que una de la tienda.
// ---------------------------------------------------------------------------

/** Facturación y cantidad de ventas manuales (histórico, para el dashboard). */
export async function getManualKpis(
  database: Database = db,
): Promise<{ revenue: number; count: number }> {
  const [row] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
    })
    .from(manualSales)
    .where(inArray(manualSales.status, SALES_STATUSES));
  return { revenue: row?.revenue ?? 0, count: row?.count ?? 0 };
}

/** KPIs de ventas manuales del año: facturación, ventas y unidades. */
export async function getManualYearKpis(
  year: number,
  database: Database = db,
): Promise<{ revenue: number; count: number; units: number }> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [row] = await database
    .select({
      revenue: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
      count: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${manualSales.quantity}), 0)::int`,
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
    revenue: row?.revenue ?? 0,
    count: row?.count ?? 0,
    units: row?.units ?? 0,
  };
}

/** Ingresos de ventas manuales por mes (1-12) de un año. */
export async function getManualMonthlyRevenue(
  year: number,
  database: Database = db,
): Promise<number[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await database
    .select({
      m: sql<number>`extract(month from ${manualSales.saleDate})::int`,
      total: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
    })
    .from(manualSales)
    .where(
      and(
        inArray(manualSales.status, SALES_STATUSES),
        gte(manualSales.saleDate, yearStart),
        lt(manualSales.saleDate, yearEnd),
      ),
    )
    .groupBy(sql`1`);
  const out = Array(12).fill(0) as number[];
  for (const r of rows) {
    if (r.m >= 1 && r.m <= 12) out[r.m - 1] = Number(r.total);
  }
  return out;
}

/** Ingresos de ventas manuales por día desde una fecha. */
export async function getManualRevenueByDay(
  since: Date,
  database: Database = db,
): Promise<Array<{ day: string; total: number }>> {
  return database
    .select({
      day: sql<string>`to_char(date_trunc('day', ${manualSales.saleDate}), 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${manualSales.total}), 0)::float8`,
    })
    .from(manualSales)
    .where(
      and(
        inArray(manualSales.status, SALES_STATUSES),
        gte(manualSales.saleDate, since),
      ),
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

// ---------------------------------------------------------------------------
// Consumo de filamento (Fase 5): gramos usados y costo asociado.
// Fuentes disponibles hoy:
//  - print_failures: gramos PERDIDOS reales por filamento (exacto).
//  - ventas de tienda: gramos ESTIMADOS = peso del producto × unidades
//    (por material; las ventas manuales no guardan gramos → no se estiman).
// ---------------------------------------------------------------------------

/** Gramos perdidos en fallas por filamento (con costo al precio actual). */
export async function getFailureConsumption(
  year: number,
  database: Database = db,
): Promise<
  Array<{ material: string; color: string; grams: number; cost: number }>
> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  return database
    .select({
      material: sql<string>`coalesce(${printFailures.material}, ${filaments.material}, 'Otro')`,
      color: sql<string>`coalesce(${printFailures.color}, ${filaments.color}, '—')`,
      grams: sql<number>`coalesce(sum(${printFailures.gramsLost}), 0)::float8`,
      cost: sql<number>`coalesce(sum(${printFailures.gramsLost} * coalesce(${filaments.costPerKg}, 0) / 1000), 0)::float8`,
    })
    .from(printFailures)
    .leftJoin(filaments, eq(printFailures.filamentId, filaments.id))
    .where(
      and(
        gte(printFailures.createdAt, yearStart),
        lt(printFailures.createdAt, yearEnd),
      ),
    )
    .groupBy(sql`1, 2`)
    .orderBy(sql`3 desc`);
}

/**
 * Gramos REALES consumidos por ventas (tienda + manuales), por material y
 * color, desde el ledger `filament_movements` (diseño 2026-07: reemplaza el
 * estimado peso × unidades). Neto del año: consumos (deltas negativos de
 * 'order'/'manual_sale') menos reposiciones ('restore' de cancelaciones/
 * borrados). Solo muestra netos positivos. Nota: el ledger arranca vacío,
 * así que las ventas anteriores a esta migración no aparecen acá.
 */
export async function getLedgerSalesConsumption(
  year: number,
  database: Database = db,
): Promise<Array<{ material: string; color: string; grams: number }>> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  return database
    .select({
      material: filamentMovements.material,
      color: filamentMovements.color,
      grams: sql<number>`coalesce(-sum(${filamentMovements.deltaGrams}), 0)::float8`,
    })
    .from(filamentMovements)
    .where(
      and(
        inArray(filamentMovements.reason, ["order", "manual_sale", "restore"]),
        gte(filamentMovements.createdAt, yearStart),
        lt(filamentMovements.createdAt, yearEnd),
      ),
    )
    .groupBy(sql`1, 2`)
    .having(sql`sum(${filamentMovements.deltaGrams}) < 0`)
    .orderBy(sql`3 desc`);
}

/** Costo promedio por kg de cada material (según filamentos cargados). */
export async function getAvgCostPerMaterial(
  database: Database = db,
): Promise<Array<{ material: string; costPerKg: number }>> {
  return database
    .select({
      material: filaments.material,
      costPerKg: sql<number>`coalesce(avg(${filaments.costPerKg}), 0)::float8`,
    })
    .from(filaments)
    .groupBy(filaments.material);
}
