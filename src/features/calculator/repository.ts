import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { calcHistory, costSettings } from "@/core/db/schema";

type Database = typeof db;

export type CalcHistoryRow = typeof calcHistory.$inferSelect;

export async function listCalcHistory(
  database: Database = db,
): Promise<CalcHistoryRow[]> {
  return database
    .select()
    .from(calcHistory)
    .orderBy(desc(calcHistory.createdAt))
    .limit(200);
}

export async function insertCalcHistory(
  values: typeof calcHistory.$inferInsert,
  database: Database = db,
): Promise<CalcHistoryRow> {
  const [row] = await database.insert(calcHistory).values(values).returning();
  if (!row) throw new Error("No se pudo guardar el cálculo");
  return row;
}

export async function deleteCalcHistoryRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(calcHistory).where(eq(calcHistory.id, id));
}

export async function getCalcStats(database: Database = db): Promise<{
  count: number;
  grams: number;
  hours: number;
  ganancia: number;
  precioFinal: number;
}> {
  const [r] = await database
    .select({
      count: sql<number>`count(*)::int`,
      grams: sql<number>`coalesce(sum(${calcHistory.grams}), 0)::float8`,
      hours: sql<number>`coalesce(sum(${calcHistory.hours}), 0)::float8`,
      ganancia: sql<number>`coalesce(sum(${calcHistory.ganancia}), 0)::float8`,
      precioFinal: sql<number>`coalesce(sum(${calcHistory.precioFinal}), 0)::float8`,
    })
    .from(calcHistory);
  return r ?? { count: 0, grams: 0, hours: 0, ganancia: 0, precioFinal: 0 };
}

/** Config de costos (tabla compartida cost_settings, fila única). */
export async function getCostConfigRow(database: Database = db) {
  const rows = await database
    .select()
    .from(costSettings)
    .where(eq(costSettings.id, 1));
  return rows[0] ?? null;
}

export async function upsertCostConfig(
  fields: Partial<typeof costSettings.$inferInsert>,
  database: Database = db,
) {
  const [row] = await database
    .insert(costSettings)
    .values({ id: 1, ...fields })
    .onConflictDoUpdate({ target: costSettings.id, set: fields })
    .returning();
  return row;
}
