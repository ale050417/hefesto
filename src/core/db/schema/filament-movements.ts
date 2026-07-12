import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { filaments } from "./filaments";

// Ledger de movimientos de filamento (2026-07): cada descuento/reposición de
// stock por ventas queda registrado acá con el delta REAL aplicado.
//  - Fuente de idempotencia de los hooks: si ya existe un movimiento con el
//    mismo (reason, ref_id), el descuento no se aplica dos veces.
//  - Fuente de verdad del reporte de consumo (F5): reemplaza el "estimado"
//    por datos reales.
//  - `delta_grams` negativo = consumo; positivo = reposición. Si la venta
//    pedía 80 g y había 50, acá queda -50 (lo que REALMENTE se descontó).
export const filamentMovements = pgTable(
  "filament_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // set null: si se borra el filamento, el movimiento histórico queda con
    // los snapshots de material/color.
    filamentId: uuid("filament_id").references(() => filaments.id, {
      onDelete: "set null",
    }),
    material: text("material").notNull(),
    color: text("color").notNull(),
    deltaGrams: numeric("delta_grams", { precision: 10, scale: 2 }).notNull(),
    // 'order' | 'manual_sale' | 'failure' | 'adjust' | 'restore'
    // (failure = impresión fallida multicolor, Bloque 3 2026-07; adjust reservado)
    reason: text("reason").notNull(),
    // id del pedido / venta manual que originó el movimiento (sin FK: el
    // ledger sobrevive al borrado del pedido para poder reponer y auditar).
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "filament_movements_reason_valid",
      sql`${t.reason} IN ('order','manual_sale','failure','adjust','restore')`,
    ),
    // Índice de idempotencia + búsqueda por origen (reason, ref_id).
    index("filament_movements_ref_idx").on(t.reason, t.refId),
    index("filament_movements_filament_idx").on(t.filamentId),
  ],
);
