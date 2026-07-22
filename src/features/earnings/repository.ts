import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  costSettings,
  filaments,
  manualSales,
  orderItems,
  orders,
  products,
  profiles,
  profitShares,
} from "@/core/db/schema";
import type { OrderStatus } from "@/features/orders/types";

type Database = typeof db;

// Estados que cuentan como venta COBRADA para el reparto: desde "pago confirmado"
// en adelante (mismo criterio que la facturación en Reportes). Decisión de Ale
// (2026-07): el reparto se cuenta al confirmar, no recién al entregar.
const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

export type CostSettingsRow = typeof costSettings.$inferSelect;
export type ProfitShare = typeof profitShares.$inferSelect;

/* ---------- Cost settings (singleton id = 1) ---------- */

export async function getCostSettingsRow(
  database: Database = db,
): Promise<CostSettingsRow | null> {
  const rows = await database
    .select()
    .from(costSettings)
    .where(eq(costSettings.id, 1));
  return rows[0] ?? null;
}

export async function upsertCostSettings(
  fields: Partial<typeof costSettings.$inferInsert>,
  database: Database = db,
): Promise<CostSettingsRow> {
  const [row] = await database
    .insert(costSettings)
    .values({ id: 1, ...fields })
    .onConflictDoUpdate({ target: costSettings.id, set: fields })
    .returning();
  if (!row) throw new Error("No se pudo guardar la configuración de costos");
  return row;
}

/* ---------- Socios ---------- */

export async function listProfitShares(
  database: Database = db,
): Promise<ProfitShare[]> {
  return database
    .select()
    .from(profitShares)
    .orderBy(asc(profitShares.sortOrder), asc(profitShares.createdAt));
}

export async function insertProfitShare(
  values: typeof profitShares.$inferInsert,
  database: Database = db,
): Promise<ProfitShare> {
  const [row] = await database.insert(profitShares).values(values).returning();
  if (!row) throw new Error("No se pudo crear el socio");
  return row;
}

export async function updateProfitShareRow(
  id: string,
  fields: Partial<typeof profitShares.$inferInsert>,
  database: Database = db,
): Promise<ProfitShare> {
  const [row] = await database
    .update(profitShares)
    .set(fields)
    .where(eq(profitShares.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el socio");
  return row;
}

export async function deleteProfitShareRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(profitShares).where(eq(profitShares.id, id));
}

/* ---------- Pedidos entregados + costos ---------- */

export type DeliveredOrder = {
  id: string;
  orderNumber: string;
  total: number;
  customerName: string | null;
  createdAt: Date;
};

export async function getDeliveredOrders(
  database: Database = db,
): Promise<DeliveredOrder[]> {
  const rows = await database
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      customerName: profiles.fullName,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(profiles, eq(profiles.id, orders.customerId))
    .where(inArray(orders.status, REVENUE_STATUSES))
    .orderBy(desc(orders.createdAt));
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    total: Number(r.total),
    customerName: r.customerName,
    createdAt: r.createdAt,
  }));
}

export type DeliveredItem = {
  orderId: string;
  quantity: number;
  weightGrams: number;
  printMinutes: number;
  material: string | null;
  /** Costo de insumos del producto (por unidad). */
  extrasCost: number;
};

export async function getDeliveredItems(
  database: Database = db,
): Promise<DeliveredItem[]> {
  const rows = await database
    .select({
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      weightGrams: products.weightGrams,
      printMinutes: products.printTimeMinutes,
      material: products.material,
      extrasCost: products.extrasCost,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(inArray(orders.status, REVENUE_STATUSES));
  return rows.map((r) => ({
    orderId: r.orderId,
    quantity: r.quantity,
    weightGrams: r.weightGrams != null ? Number(r.weightGrams) : 0,
    printMinutes: r.printMinutes != null ? Number(r.printMinutes) : 0,
    material: r.material,
    extrasCost: r.extrasCost != null ? Number(r.extrasCost) : 0,
  }));
}

/* ---------- Ventas manuales cobradas ---------- */

export type DeliveredManualSale = {
  id: string;
  customerName: string;
  detail: string | null;
  total: number;
  amortization: number;
  profitSplit: Array<{ name: string; pct: number }> | null;
  createdAt: Date;
};

/**
 * Ventas manuales en estado "delivered" (cobradas). Suman al reparto de
 * ganancias igual que un pedido entregado. Sin items: la economía las trata con
 * amortización 0 (ver economics.manualSaleEconomics).
 */
export async function getDeliveredManualSales(
  database: Database = db,
): Promise<DeliveredManualSale[]> {
  const rows = await database
    .select({
      id: manualSales.id,
      customerName: manualSales.customerName,
      detail: manualSales.detail,
      total: manualSales.total,
      amortization: manualSales.amortization,
      profitSplit: manualSales.profitSplit,
      createdAt: manualSales.saleDate,
    })
    .from(manualSales)
    .where(inArray(manualSales.status, REVENUE_STATUSES))
    .orderBy(desc(manualSales.saleDate));
  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    detail: r.detail,
    total: Number(r.total),
    amortization: r.amortization != null ? Number(r.amortization) : 0,
    profitSplit: r.profitSplit ?? null,
    createdAt: r.createdAt,
  }));
}

/**
 * Mapa material → costo/kg. Los items del pedido solo guardan el material del
 * producto (no un filamento concreto), así que si hay varios filamentos del
 * mismo material con distinto precio se toma el MÁS CARO: conservador, la
 * ganancia mostrada nunca queda inflada (fix auditoría 2026-07 — antes ganaba
 * el "primer" filamento arbitrario).
 */
export async function getFilamentCostByMaterial(
  database: Database = db,
): Promise<Map<string, number>> {
  const rows = await database
    .select({ material: filaments.material, cost: filaments.costPerKg })
    .from(filaments);
  const map = new Map<string, number>();
  for (const r of rows) {
    const cost = Number(r.cost);
    const prev = map.get(r.material);
    if (prev == null || cost > prev) map.set(r.material, cost);
  }
  return map;
}
