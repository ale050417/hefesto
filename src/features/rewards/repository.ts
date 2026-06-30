import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { pointTransactions, rewards } from "@/core/db/schema";

type Database = typeof db;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type Reward = typeof rewards.$inferSelect;

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

/* ===================== Catálogo de recompensas ===================== */

export async function listRewards(database: Database = db): Promise<Reward[]> {
  return database
    .select()
    .from(rewards)
    .orderBy(asc(rewards.sortOrder), asc(rewards.costPoints));
}

export async function findRewardById(
  id: string,
  database: Database = db,
): Promise<Reward | null> {
  const rows = await database.select().from(rewards).where(eq(rewards.id, id));
  return rows[0] ?? null;
}

export async function insertReward(
  values: typeof rewards.$inferInsert,
  database: Database = db,
): Promise<Reward> {
  const [row] = await database.insert(rewards).values(values).returning();
  if (!row) throw new Error("No se pudo crear la recompensa");
  return row;
}

export async function updateRewardRow(
  id: string,
  fields: Partial<typeof rewards.$inferInsert>,
  database: Database = db,
): Promise<Reward> {
  const [row] = await database
    .update(rewards)
    .set(fields)
    .where(eq(rewards.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar la recompensa");
  return row;
}

export async function deleteRewardRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(rewards).where(eq(rewards.id, id));
}

/** Estadísticas globales de puntos (todos los clientes). */
export async function getPointsStats(database: Database = db): Promise<{
  inCirculation: number;
  redemptions: number;
  pointsRedeemed: number;
}> {
  const rows = await database
    .select({
      inCirculation: sql<number>`coalesce(sum(${pointTransactions.delta}), 0)::int`,
      redemptions: sql<number>`coalesce(sum(case when ${pointTransactions.delta} < 0 then 1 else 0 end), 0)::int`,
      pointsRedeemed: sql<number>`coalesce(sum(case when ${pointTransactions.delta} < 0 then -${pointTransactions.delta} else 0 end), 0)::int`,
    })
    .from(pointTransactions);
  return rows[0] ?? { inCirculation: 0, redemptions: 0, pointsRedeemed: 0 };
}
