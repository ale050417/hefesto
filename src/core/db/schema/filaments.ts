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
    // Datos de catálogo del filamento (marca, diámetro nominal).
    brand: text("brand").notNull().default("Genérico"),
    diameter: text("diameter").notNull().default("1.75"),
    stockGrams: numeric("stock_grams", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    // Tamaño del carrete (g): cuánto suma "+ carrete".
    spoolGrams: numeric("spool_grams", { precision: 10, scale: 2 })
      .notNull()
      .default("1000"),
    // Costo por kg (ARS) para valorizar el inventario.
    costPerKg: numeric("cost_per_kg", { precision: 12, scale: 2 })
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
    check("filaments_spool_positive", sql`${t.spoolGrams} > 0`),
    check("filaments_cost_non_negative", sql`${t.costPerKg} >= 0`),
  ],
);
