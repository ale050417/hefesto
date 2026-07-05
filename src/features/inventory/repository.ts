import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { filaments, printFailures } from "@/core/db/schema";
import type { Filament, PrintFailure } from "./types";

type Database = typeof db;

export async function listFilaments(
  database: Database = db,
): Promise<Filament[]> {
  return database.query.filaments.findMany({
    orderBy: (f, { asc }) => [asc(f.material), asc(f.color)],
  });
}

export async function findFilamentById(
  id: string,
  database: Database = db,
): Promise<Filament | null> {
  const row = await database.query.filaments.findFirst({
    where: eq(filaments.id, id),
  });
  return row ?? null;
}

export async function insertFilament(
  values: typeof filaments.$inferInsert,
  database: Database = db,
): Promise<Filament> {
  const [row] = await database.insert(filaments).values(values).returning();
  if (!row) throw new Error("No se pudo crear el filamento");
  return row;
}

export async function updateFilamentRow(
  id: string,
  fields: Partial<typeof filaments.$inferInsert>,
  database: Database = db,
): Promise<Filament> {
  const [row] = await database
    .update(filaments)
    .set(fields)
    .where(eq(filaments.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el filamento");
  return row;
}

export async function deleteFilamentRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(filaments).where(eq(filaments.id, id));
}

/** Filamento que coincide con material+color (fallback: solo color). */
export async function findFilamentByMaterialColor(
  material: string,
  color: string,
  database: Database = db,
): Promise<Filament | null> {
  const exact = await database.query.filaments.findFirst({
    where: and(eq(filaments.material, material), eq(filaments.color, color)),
  });
  if (exact) return exact;
  const byColor = await database.query.filaments.findFirst({
    where: eq(filaments.color, color),
  });
  return byColor ?? null;
}

export async function listFailures(
  database: Database = db,
): Promise<PrintFailure[]> {
  return database.query.printFailures.findMany({
    orderBy: (f, { desc: d }) => [d(f.createdAt)],
    limit: 200,
  });
}

export async function updateFailureRow(
  id: string,
  fields: Partial<typeof printFailures.$inferInsert>,
  database: Database = db,
): Promise<PrintFailure> {
  const [row] = await database
    .update(printFailures)
    .set(fields)
    .where(eq(printFailures.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar la falla");
  return row;
}

export async function deleteFailureRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(printFailures).where(eq(printFailures.id, id));
}

export async function findFailureById(
  id: string,
  database: Database = db,
): Promise<PrintFailure | null> {
  const row = await database.query.printFailures.findFirst({
    where: eq(printFailures.id, id),
  });
  return row ?? null;
}

/**
 * Devuelve stock (si corresponde) y borra la falla, en UNA transacción: o se
 * repone y borra, o no se toca nada. Espejo inverso de `registerFailureTx`.
 */
export async function deleteFailureTx(
  params: {
    failureId: string;
    stockUpdate?: { filamentId: string; newStock: number };
  },
  database: Database = db,
): Promise<void> {
  await database.transaction(async (tx) => {
    if (params.stockUpdate) {
      await tx
        .update(filaments)
        .set({ stockGrams: String(params.stockUpdate.newStock) })
        .where(eq(filaments.id, params.stockUpdate.filamentId));
    }
    await tx
      .delete(printFailures)
      .where(eq(printFailures.id, params.failureId));
  });
}

/** Inserta la falla y (si corresponde) descuenta el stock, en una transacción. */
export async function registerFailureTx(
  params: {
    failure: {
      filamentId: string | null;
      pieceName: string;
      material: string;
      color: string;
      gramsLost: number;
      reason: string;
      notes: string | null;
      deducted: boolean;
    };
    stockUpdate?: { filamentId: string; newStock: number };
  },
  database: Database = db,
): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.insert(printFailures).values({
      filamentId: params.failure.filamentId,
      pieceName: params.failure.pieceName,
      material: params.failure.material,
      color: params.failure.color,
      gramsLost: String(params.failure.gramsLost),
      reason: params.failure.reason,
      notes: params.failure.notes,
      deducted: params.failure.deducted,
    });
    if (params.stockUpdate) {
      await tx
        .update(filaments)
        .set({ stockGrams: String(params.stockUpdate.newStock) })
        .where(eq(filaments.id, params.stockUpdate.filamentId));
    }
  });
}
