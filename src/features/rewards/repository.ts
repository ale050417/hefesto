import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { pointTransactions } from "@/core/db/schema";

type Database = typeof db;
export type PointTransaction = typeof pointTransactions.$inferSelect;

export async function getBalance(
  customerId: string,
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({
      total: sql<number>`COALESCE(SUM(${pointTransactions.delta}), 0)`,
    })
    .from(pointTransactions)
    .where(eq(pointTransactions.customerId, customerId));
  return Number(rows[0]?.total ?? 0);
}

export async function listTransactions(
  customerId: string,
  limit = 50,
  database: Database = db,
): Promise<PointTransaction[]> {
  return database
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.customerId, customerId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);
}

export async function hasOrderAward(
  orderId: string,
  database: Database = db,
): Promise<boolean> {
  const rows = await database
    .select({ id: pointTransactions.id })
    .from(pointTransactions)
    .where(eq(pointTransactions.orderId, orderId))
    .limit(1);
  return rows.length > 0;
}

export async function addTransaction(
  values: typeof pointTransactions.$inferInsert,
  database: Database = db,
): Promise<void> {
  await database.insert(pointTransactions).values(values);
}
