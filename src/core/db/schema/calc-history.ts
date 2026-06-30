import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Historial de presupuestos de la calculadora 3D (scratchpad del taller).
export const calcHistory = pgTable(
  "calc_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    customer: text("customer"),
    material: text("material"),
    color: text("color"),
    grams: numeric("grams", { precision: 10, scale: 2 }).notNull().default("0"),
    hours: numeric("hours", { precision: 8, scale: 2 }).notNull().default("0"),
    costPerKg: numeric("cost_per_kg", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    marginPct: numeric("margin_pct", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    costoTotal: numeric("costo_total", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    ganancia: numeric("ganancia", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    precioFinal: numeric("precio_final", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("calc_history_created_idx").on(t.createdAt)],
);
