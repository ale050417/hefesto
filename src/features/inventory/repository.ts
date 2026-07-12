import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import {
  filamentCatalog,
  filamentMovements,
  filaments,
  printFailures,
} from "@/core/db/schema";
import type {
  Filament,
  FilamentMovement,
  FilamentMovementReason,
  LowStockFilament,
  NewFilamentMovement,
  PrintFailure,
} from "./types";
import { resolveStockDelta } from "./stock-delta";

type Database = typeof db;
// El parámetro `tx` que entrega database.transaction (para componer varias
// escrituras atómicas en una sola transacción, ej. falla + descuento).
type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

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

// --- Ledger de movimientos de filamento (ventas ↔ stock) ---

/** Movimientos originados por un pedido/venta puntual (reason + ref_id). */
export async function findMovementsByRef(
  reason: FilamentMovementReason,
  refId: string,
  database: Database = db,
): Promise<FilamentMovement[]> {
  return database.query.filamentMovements.findMany({
    where: and(
      eq(filamentMovements.reason, reason),
      eq(filamentMovements.refId, refId),
    ),
  });
}

/** ¿Ya existe un movimiento con este (reason, ref_id)? Base de la idempotencia. */
export async function existsMovementByRef(
  reason: FilamentMovementReason,
  refId: string,
  database: Database = db,
): Promise<boolean> {
  const row = await database.query.filamentMovements.findFirst({
    columns: { id: true },
    where: and(
      eq(filamentMovements.reason, reason),
      eq(filamentMovements.refId, refId),
    ),
  });
  return row != null;
}

/**
 * Aplica N deltas de stock y registra sus movimientos, todo en UNA transacción.
 * Reglas (diseño 2026-07, toca stock → tests en el service):
 *  - El stock nunca baja de 0 (la tabla tiene CHECK >= 0): se aplica
 *    GREATEST(stock + delta, 0) y el movimiento registra el delta REAL
 *    aplicado (pedía -80 con 50 en stock → queda -50).
 *  - Se registra el movimiento AUNQUE el delta real sea 0 (stock ya estaba en
 *    0): el registro es el marcador de idempotencia y la traza de auditoría.
 *  - La fila del filamento se bloquea (FOR UPDATE) para que dos ventas
 *    concurrentes no pisen la misma lectura de stock.
 *  - Si el filamento fue borrado en el medio, no hay stock que tocar y el
 *    movimiento queda con filament_id null (snapshots material/color).
 */
async function applyDeltasOnTx(
  tx: Tx,
  movements: NewFilamentMovement[],
): Promise<LowStockFilament[]> {
  const low: LowStockFilament[] = [];
  for (const m of movements) {
    const [row] = await tx
      .select({
        id: filaments.id,
        stockGrams: filaments.stockGrams,
        alertThresholdGrams: filaments.alertThresholdGrams,
        material: filaments.material,
        color: filaments.color,
      })
      .from(filaments)
      .where(eq(filaments.id, m.filamentId))
      .for("update");

    let applied = 0;
    let filamentId: string | null = null;
    if (row) {
      const threshold = Number(row.alertThresholdGrams);
      const { newStock, appliedDelta, atThreshold, shortfall } =
        resolveStockDelta(Number(row.stockGrams), m.deltaGrams, threshold);
      applied = appliedDelta;
      filamentId = row.id;
      await tx
        .update(filaments)
        .set({ stockGrams: String(newStock) })
        .where(eq(filaments.id, row.id));
      // Aviso en bajas: quedo en/bajo el umbral, o falto (shortfall).
      if (atThreshold || shortfall) {
        low.push({
          filamentId: row.id,
          material: row.material,
          color: row.color,
          stockGrams: newStock,
          threshold,
          shortfall,
        });
      }
    }

    await tx.insert(filamentMovements).values({
      filamentId,
      material: m.material,
      color: m.color,
      deltaGrams: applied.toFixed(2),
      reason: m.reason,
      refId: m.refId,
    });
  }
  return low;
}

export async function applyFilamentDeltasTx(
  movements: NewFilamentMovement[],
  database: Database = db,
): Promise<LowStockFilament[]> {
  if (movements.length === 0) return [];
  return database.transaction((tx) => applyDeltasOnTx(tx, movements));
}

/**
 * Registra una falla y descuenta N carretes (multicolor) en UNA transaccion.
 * Inserta la fila de la falla, y con su id como refId aplica los movimientos
 * (reason=failure). Devuelve el id y los carretes que quedaron bajos/faltantes.
 */
export async function registerFailureWithDeltasTx(
  failure: {
    filamentId: string | null;
    pieceName: string;
    material: string;
    color: string;
    gramsLost: number;
    reason: string;
    notes: string | null;
    deducted: boolean;
  },
  movements: Omit<NewFilamentMovement, "refId">[],
  database: Database = db,
): Promise<{ failureId: string; low: LowStockFilament[] }> {
  return database.transaction(async (tx) => {
    const [row] = await tx
      .insert(printFailures)
      .values({
        filamentId: failure.filamentId,
        pieceName: failure.pieceName,
        material: failure.material,
        color: failure.color,
        gramsLost: String(failure.gramsLost),
        reason: failure.reason,
        notes: failure.notes,
        deducted: failure.deducted,
      })
      .returning({ id: printFailures.id });
    const failureId = row!.id;
    const low =
      failure.deducted && movements.length > 0
        ? await applyDeltasOnTx(
            tx,
            movements.map((m) => ({ ...m, refId: failureId })),
          )
        : [];
    return { failureId, low };
  });
}

/**
 * Borra una falla DEVOLVIENDO al stock lo que habia descontado por el ledger
 * (reason=failure, ref_id=falla). Repone el delta REAL aplicado de cada
 * carrete, borra esos movimientos y la fila. Reemplaza el camino directo viejo.
 */
export async function deleteFailureWithLedgerTx(
  failureId: string,
  database: Database = db,
): Promise<void> {
  await database.transaction(async (tx) => {
    const movs = await tx
      .select({
        filamentId: filamentMovements.filamentId,
        deltaGrams: filamentMovements.deltaGrams,
      })
      .from(filamentMovements)
      .where(
        and(
          eq(filamentMovements.reason, "failure"),
          eq(filamentMovements.refId, failureId),
        ),
      );
    for (const m of movs) {
      const applied = Number(m.deltaGrams); // negativo (o 0)
      if (m.filamentId && applied < 0) {
        const [row] = await tx
          .select({ stockGrams: filaments.stockGrams })
          .from(filaments)
          .where(eq(filaments.id, m.filamentId))
          .for("update");
        if (row) {
          await tx
            .update(filaments)
            .set({ stockGrams: String(Number(row.stockGrams) - applied) })
            .where(eq(filaments.id, m.filamentId));
        }
      }
    }
    await tx
      .delete(filamentMovements)
      .where(
        and(
          eq(filamentMovements.reason, "failure"),
          eq(filamentMovements.refId, failureId),
        ),
      );
    await tx.delete(printFailures).where(eq(printFailures.id, failureId));
  });
}

/**
 * Reversa de un descuento (pedido cancelado/reembolsado/borrado, venta manual
 * borrada): por cada movimiento de consumo de (reason, ref_id) devuelve los
 * gramos REALMENTE descontados e inserta el compensatorio (reason 'restore',
 * mismo ref_id). Idempotente: si ya hay un 'restore' para ese ref, no hace
 * nada. Todo en UNA transacción. Devuelve los gramos devueltos al stock.
 */
export async function restoreMovementsByRefTx(
  reason: FilamentMovementReason,
  refId: string,
  database: Database = db,
): Promise<number> {
  return database.transaction(async (tx) => {
    const already = await tx
      .select({ id: filamentMovements.id })
      .from(filamentMovements)
      .where(
        and(
          eq(filamentMovements.reason, "restore"),
          eq(filamentMovements.refId, refId),
        ),
      )
      .limit(1);
    if (already.length > 0) return 0;

    const movements = await tx
      .select()
      .from(filamentMovements)
      .where(
        and(
          eq(filamentMovements.reason, reason),
          eq(filamentMovements.refId, refId),
        ),
      );

    let restored = 0;
    for (const m of movements) {
      const grams = -Number(m.deltaGrams); // consumo fue negativo → devolver +
      if (grams <= 0) continue; // delta real 0: no hay nada que compensar

      if (m.filamentId) {
        const [row] = await tx
          .select({ id: filaments.id, stockGrams: filaments.stockGrams })
          .from(filaments)
          .where(eq(filaments.id, m.filamentId))
          .for("update");
        if (row) {
          await tx
            .update(filaments)
            .set({ stockGrams: String(Number(row.stockGrams) + grams) })
            .where(eq(filaments.id, row.id));
          restored += grams;
        }
      }

      // El compensatorio se inserta aunque el filamento ya no exista: deja el
      // ledger saldado (consumo neto 0) para el reporte de consumo real.
      await tx.insert(filamentMovements).values({
        filamentId: m.filamentId,
        material: m.material,
        color: m.color,
        deltaGrams: grams.toFixed(2),
        reason: "restore",
        refId,
      });
    }
    return restored;
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

// --- Catálogo de colores y marcas (0042) ---
export type CatalogRow = { id: string; name: string; hex: string | null };

export async function listFilamentCatalog(
  kind: "color" | "brand",
  database: Database = db,
): Promise<CatalogRow[]> {
  return database
    .select({
      id: filamentCatalog.id,
      name: filamentCatalog.name,
      hex: filamentCatalog.hex,
    })
    .from(filamentCatalog)
    .where(eq(filamentCatalog.kind, kind))
    .orderBy(asc(filamentCatalog.name));
}

export async function deleteFilamentCatalog(
  kind: "color" | "brand",
  name: string,
  database: Database = db,
): Promise<void> {
  await database
    .delete(filamentCatalog)
    .where(and(eq(filamentCatalog.kind, kind), eq(filamentCatalog.name, name)));
}

export async function insertFilamentCatalog(
  kind: "color" | "brand",
  name: string,
  hex: string | null,
  database: Database = db,
): Promise<void> {
  await database
    .insert(filamentCatalog)
    .values({ kind, name, hex })
    .onConflictDoNothing();
}

// Colores usados por cada venta (online + manual), leídos del ledger de
// movimientos. Sirve para mostrar "qué color(es)" en el listado de Pedidos sin
// guardar nada extra en la venta (el movimiento ya tiene color + refId).
export async function getSaleColors(
  database: Database = db,
): Promise<Array<{ refId: string | null; color: string }>> {
  return database
    .selectDistinct({
      refId: filamentMovements.refId,
      color: filamentMovements.color,
    })
    .from(filamentMovements)
    .where(inArray(filamentMovements.reason, ["order", "manual_sale"]));
}
