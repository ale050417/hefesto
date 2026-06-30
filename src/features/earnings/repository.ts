import { asc, desc, eq } from "drizzle-orm";
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

type Database = typeof db;

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
    .where(eq(orders.status, "delivered"))
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
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.status, "delivered"));
  return rows.map((r) => ({
    orderId: r.orderId,
    quantity: r.quantity,
    weightGrams: r.weightGrams != null ? Number(r.weightGrams) : 0,
    printMinutes: r.printMinutes != null ? Number(r.printMinutes) : 0,
    material: r.material,
  }));
}

/* ---------- Ventas manuales cobradas ---------- */

export type DeliveredManualSale = {
  id: string;
  customerName: string;
  detail: string | null;
  total: number;
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
      profitSplit: manualSales.profitSplit,
      createdAt: manualSales.saleDate,
    })
    .from(manualSales)
    .where(eq(manualSales.status, "delivered"))
    .orderBy(desc(manualSales.saleDate));
  return rows.map((r) => ({
    id: r.id,
    customerName: r.customerName,
    detail: r.detail,
    total: Number(r.total),
    profitSplit: r.profitSplit ?? null,
    createdAt: r.createdAt,
  }));
}

/** Mapa material → costo/kg (primer filamento de ese material). */
export async function getFilamentCostByMaterial(
  database: Database = db,
): Promise<Map<string, number>> {
  const rows = await database
    .select({ material: filaments.material, cost: filaments.costPerKg })
    .from(filaments);
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!map.has(r.material)) map.set(r.material, Number(r.cost));
  }
  return map;
}
