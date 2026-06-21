import { sql } from "drizzle-orm";
import {
  check,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Inventario: filamento por material/color, stock en gramos (Cap. 10 / Fase 7).
export const filaments = pgTable(
  "filaments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    material: text("material").notNull(),
    color: text("color").notNull(),
    stockGrams: numeric("stock_grams", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    alertThresholdGrams: numeric("alert_threshold_grams", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("filaments_stock_non_negative", sql`${t.stockGrams} >= 0`),
    check(
      "filaments_threshold_non_negative",
      sql`${t.alertThresholdGrams} >= 0`,
    ),
  ],
);
