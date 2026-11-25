import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Tipos de filamento con su precio por kg (0084, pedido de Agustín): el precio
// se carga una vez por tipo (PLA, PETG, PLA Silk…) y cada carrete elige el
// suyo. `filaments.costPerKg` queda como copia: cambia junto con el tipo.
export const filamentTypes = pgTable(
  "filament_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    costPerKg: numeric("cost_per_kg", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("filament_types_cost_non_negative", sql`${t.costPerKg} >= 0`)],
);

// Modelos de carrete con su peso VACÍO (0084): filamento que queda = peso del
// carrete en uso − peso del carrete vacío.
export const spoolModels = pgTable(
  "spool_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    emptyGrams: numeric("empty_grams", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("spool_models_empty_non_negative", sql`${t.emptyGrams} >= 0`)],
);
