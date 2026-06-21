import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { orders, profiles } from "@/core/db/schema";

export type CustomerRow = {
  id: string;
  fullName: string | null;
  phone: string | null;
  createdAt: Date;
  orderCount: number;
  totalSpent: number;
};

// Suma solo pedidos en estados que cuentan como venta real.
const spentExpr = sql<number>`COALESCE(SUM(CASE WHEN ${orders.status} IN ('confirmed','in_production','ready','shipped','delivered') THEN ${orders.total} ELSE 0 END), 0)`;
const salesCountExpr = sql<number>`COUNT(${orders.id})`;

export async function listCustomers(): Promise<CustomerRow[]> {
  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      phone: profiles.phone,
      createdAt: profiles.createdAt,
      orderCount: salesCountExpr,
      totalSpent: spentExpr,
    })
    .from(profiles)
    .leftJoin(orders, eq(orders.customerId, profiles.id))
    .where(eq(profiles.role, "customer"))
    .groupBy(profiles.id)
    .orderBy(desc(spentExpr))
    .limit(500);
  return rows.map((r) => ({
    ...r,
    orderCount: Number(r.orderCount),
    totalSpent: Number(r.totalSpent),
  }));
}

export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      phone: profiles.phone,
      createdAt: profiles.createdAt,
      orderCount: salesCountExpr,
      totalSpent: spentExpr,
    })
    .from(profiles)
    .leftJoin(orders, eq(orders.customerId, profiles.id))
    .where(eq(profiles.id, id))
    .groupBy(profiles.id)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    orderCount: Number(row.orderCount),
    totalSpent: Number(row.totalSpent),
  };
}

export type CustomerOrderRow = {
  orderNumber: string;
  status: string;
  total: number;
  createdAt: Date;
};

export async function listCustomerOrders(
  customerId: string,
): Promise<CustomerOrderRow[]> {
  const rows = await db
    .select({
      orderNumber: orders.orderNumber,
      status: orders.status,
      total: orders.total,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}
