import { eq } from "drizzle-orm";
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

export async function listFailures(
  database: Database = db,
): Promise<PrintFailure[]> {
  return database.query.printFailures.findMany({
    orderBy: (f, { desc: d }) => [d(f.createdAt)],
    limit: 200,
  });
}

/** Inserta la falla y (si corresponde) descuenta el stock, en una transacción. */
export async function registerFailureTx(
  params: {
    failure: {
      filamentId: string;
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
