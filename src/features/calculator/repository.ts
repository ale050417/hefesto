import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { calcHistory, calcMarginPresets, costSettings } from "@/core/db/schema";

type Database = typeof db;

export type CalcHistoryRow = typeof calcHistory.$inferSelect;
export type MarginPresetRow = typeof calcMarginPresets.$inferSelect;

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

/* ---------- Tipos de producto con margen (calc_margin_presets) ---------- */

/** Todos los tipos (admin: incluye inactivos). Ordenados por sort_order. */
export async function listMarginPresets(
  database: Database = db,
): Promise<MarginPresetRow[]> {
  return database
    .select()
    .from(calcMarginPresets)
    .orderBy(
      asc(calcMarginPresets.sortOrder),
      asc(calcMarginPresets.createdAt),
    );
}

/** Solo los tipos activos (para el select del operador en la calculadora). */
export async function listActiveMarginPresets(
  database: Database = db,
): Promise<MarginPresetRow[]> {
  return database
    .select()
    .from(calcMarginPresets)
    .where(eq(calcMarginPresets.active, true))
    .orderBy(
      asc(calcMarginPresets.sortOrder),
      asc(calcMarginPresets.createdAt),
    );
}

export async function insertMarginPreset(
  values: typeof calcMarginPresets.$inferInsert,
  database: Database = db,
): Promise<MarginPresetRow> {
  const [row] = await database
    .insert(calcMarginPresets)
    .values(values)
    .returning();
  if (!row) throw new Error("No se pudo crear el tipo de producto");
  return row;
}

export async function updateMarginPresetRow(
  id: string,
  fields: Partial<typeof calcMarginPresets.$inferInsert>,
  database: Database = db,
): Promise<MarginPresetRow> {
  const [row] = await database
    .update(calcMarginPresets)
    .set(fields)
    .where(eq(calcMarginPresets.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el tipo de producto");
  return row;
}

export async function deleteMarginPresetRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(calcMarginPresets).where(eq(calcMarginPresets.id, id));
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
