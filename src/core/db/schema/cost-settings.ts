import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
} from "drizzle-orm/pg-core";

// Config de costos para amortización (fila única, id = 1). Material + luz +
// desgaste de máquina por hora de impresión. Usada en "Ganancias y socios".
export const costSettings = pgTable(
  "cost_settings",
  {
    id: integer("id").primaryKey().default(1),
    kwhPrice: numeric("kwh_price", { precision: 12, scale: 2 })
      .notNull()
      .default("95"),
    machineWatts: integer("machine_watts").notNull().default(220),
    machineLifeHours: integer("machine_life_hours").notNull().default(8000),
    maintenanceCost: numeric("maintenance_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("320000"),
    // % de margen de error sobre el costo (usado por la calculadora).
    marginErrorPct: numeric("margin_error_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("8"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("cost_settings_singleton", sql`${t.id} = 1`)],
);
