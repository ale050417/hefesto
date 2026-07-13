import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { addresses, manualCustomers, orders, profiles } from "@/core/db/schema";
import type { Address, ManualCustomer, Order, Profile } from "./types";

type Database = typeof db;

// "Gastado" suma solo pedidos en estados de venta real (no pendiente de pago,
// ni cancelado/reembolsado). Mismo criterio que el reporte de clientes previo.
const revenueSpentExpr = sql<number>`coalesce(sum(case when ${orders.status} in ('confirmed','in_production','ready','shipped','delivered') then ${orders.total} else 0 end), 0)::float8`;

export async function getProfile(
  id: string,
  database: Database = db,
): Promise<Profile | null> {
  const row = await database.query.profiles.findFirst({
    where: eq(profiles.id, id),
  });
  return row ?? null;
}

export async function updateProfileRow(
  id: string,
  fields: {
    fullName?: string | null;
    phone?: string | null;
    birthDate?: string | null;
  },
  database: Database = db,
): Promise<Profile> {
  const [row] = await database
    .update(profiles)
    .set(fields)
    .where(eq(profiles.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el perfil");
  return row;
}

/* ===================== Panel admin: clientes ===================== */

/**
 * Todos los clientes registrados, más nuevos primero. Doble filtro:
 * rol `customer` (el enum-portón) Y sin rol de equipo asignado (`role_id`).
 * Así el personal del taller (Equipo de gestión) NUNCA aparece como cliente,
 * aunque su enum haya quedado en customer (pedido de Ale, 2026-07-09).
 */
export async function listCustomerProfiles(
  database: Database = db,
): Promise<Profile[]> {
  return database.query.profiles.findMany({
    where: and(eq(profiles.role, "customer"), isNull(profiles.roleId)),
    orderBy: (p, { desc: d }) => [d(p.createdAt)],
  });
}

/** Cantidad de pedidos y total gastado por cliente (excluye cancelados). */
export async function getCustomerOrderAggregates(
  ids: string[],
  database: Database = db,
): Promise<Map<string, { orders: number; spent: number }>> {
  const map = new Map<string, { orders: number; spent: number }>();
  if (ids.length === 0) return map;
  const rows = await database
    .select({
      customerId: orders.customerId,
      orders: sql<number>`count(*)::int`,
      spent: revenueSpentExpr,
    })
    .from(orders)
    .where(inArray(orders.customerId, ids))
    .groupBy(orders.customerId);
  for (const r of rows) {
    map.set(r.customerId, { orders: r.orders, spent: r.spent });
  }
  return map;
}

/** Ciudad de la dirección principal (o la más reciente) por cliente. */
export async function getDefaultCities(
  ids: string[],
  database: Database = db,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await database
    .select({
      customerId: addresses.customerId,
      city: addresses.city,
    })
    .from(addresses)
    .where(inArray(addresses.customerId, ids))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));
  for (const r of rows) {
    if (!map.has(r.customerId)) map.set(r.customerId, r.city);
  }
  return map;
}

/** Historial de pedidos de un cliente (para el detalle). */
export async function listOrdersByCustomer(
  customerId: string,
  database: Database = db,
): Promise<Order[]> {
  return database.query.orders.findMany({
    where: eq(orders.customerId, customerId),
    orderBy: (o, { desc: d }) => [d(o.createdAt)],
    limit: 50,
  });
}

/** Nota interna del taller sobre un cliente registrado. */
export async function updateProfileNote(
  id: string,
  note: string | null,
  database: Database = db,
): Promise<Profile | null> {
  const [row] = await database
    .update(profiles)
    .set({ adminNote: note })
    .where(eq(profiles.id, id))
    .returning();
  return row ?? null;
}

/* ----- Clientes manuales (sin cuenta) ----- */

export async function listManualCustomers(
  database: Database = db,
): Promise<ManualCustomer[]> {
  return database.query.manualCustomers.findMany({
    orderBy: (m, { desc: d }) => [d(m.createdAt)],
  });
}

export async function getManualCustomerById(
  id: string,
  database: Database = db,
): Promise<ManualCustomer | null> {
  const row = await database.query.manualCustomers.findFirst({
    where: eq(manualCustomers.id, id),
  });
  return row ?? null;
}

export async function insertManualCustomer(
  values: typeof manualCustomers.$inferInsert,
  database: Database = db,
): Promise<ManualCustomer> {
  const [row] = await database
    .insert(manualCustomers)
    .values(values)
    .returning();
  if (!row) throw new Error("No se pudo crear el cliente");
  return row;
}

export async function updateManualCustomerRow(
  id: string,
  fields: Partial<typeof manualCustomers.$inferInsert>,
  database: Database = db,
): Promise<ManualCustomer | null> {
  const [row] = await database
    .update(manualCustomers)
    .set(fields)
    .where(eq(manualCustomers.id, id))
    .returning();
  return row ?? null;
}

export async function listAddresses(
  customerId: string,
  database: Database = db,
): Promise<Address[]> {
  return database.query.addresses.findMany({
    where: eq(addresses.customerId, customerId),
    orderBy: (a, { desc: d }) => [d(a.isDefault), d(a.createdAt)],
  });
}

export async function findAddressById(
  id: string,
  database: Database = db,
): Promise<Address | null> {
  const row = await database.query.addresses.findFirst({
    where: eq(addresses.id, id),
  });
  return row ?? null;
}

export async function insertAddress(
  values: typeof addresses.$inferInsert,
  database: Database = db,
): Promise<Address> {
  const [row] = await database.insert(addresses).values(values).returning();
  if (!row) throw new Error("No se pudo crear la dirección");
  return row;
}

export async function updateAddressRow(
  id: string,
  fields: Partial<typeof addresses.$inferInsert>,
  database: Database = db,
): Promise<Address> {
  const [row] = await database
    .update(addresses)
    .set(fields)
    .where(eq(addresses.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar la dirección");
  return row;
}

export async function deleteAddressRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(addresses).where(eq(addresses.id, id));
}

export async function clearDefaultAddresses(
  customerId: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.customerId, customerId)));
}
