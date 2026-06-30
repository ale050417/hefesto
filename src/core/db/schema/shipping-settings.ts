import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Config de envíos (fila única, id = 1). Ciudad propia + zonas/barrios con
// precio; fuera de la ciudad se coordina por chat (a cargo del comprador).
export const shippingSettings = pgTable(
  "shipping_settings",
  {
    id: integer("id").primaryKey().default(1),
    city: text("city"),
    freeOver: numeric("free_over", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    outMsg: text("out_msg"),
    zones: jsonb("zones").$type<Array<{ name: string; price: number }>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("shipping_settings_singleton", sql`${t.id} = 1`)],
);
