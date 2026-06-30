import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Tipos de producto con su margen de ganancia (%) para la calculadora.
// El admin los administra; el operador elige el tipo sin ver el margen.
// El margen puede superar el 100% (ej: 200%), por eso solo se valida >= 0.
export const calcMarginPresets = pgTable(
  "calc_margin_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    marginPct: numeric("margin_pct", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("calc_margin_presets_pct_nonneg", sql`${t.marginPct} >= 0`)],
);
