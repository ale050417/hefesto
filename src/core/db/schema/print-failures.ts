import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { filaments } from "./filaments";

// Fallas de impresión: descuentan filamento (si deducted). Snapshot de
// material/color para conservar el dato aunque el filamento se borre.
export const printFailures = pgTable(
  "print_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filamentId: uuid("filament_id").references(() => filaments.id, {
      onDelete: "set null",
    }),
    pieceName: text("piece_name").notNull(),
    material: text("material"),
    color: text("color"),
    gramsLost: numeric("grams_lost", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    deducted: boolean("deducted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("print_failures_grams_positive", sql`${t.gramsLost} > 0`),
    index("print_failures_filament_idx").on(t.filamentId),
  ],
);
