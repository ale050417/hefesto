import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Config de métodos de pago (fila única, id = 1). Define cuáles se ofrecen en
// el checkout y sus datos. (MercadoPago real se conecta por env vars.)
export const paymentSettings = pgTable(
  "payment_settings",
  {
    id: integer("id").primaryKey().default(1),
    transferEnabled: boolean("transfer_enabled").notNull().default(true),
    transferAlias: text("transfer_alias"),
    transferCbu: text("transfer_cbu"),
    mpEnabled: boolean("mp_enabled").notNull().default(true),
    mpNote: text("mp_note"),
    // Access Token de MercadoPago del vendedor. Se pega desde el panel y se usa
    // en el checkout. SECRETO: server-only, NUNCA se manda al cliente.
    mpAccessToken: text("mp_access_token"),
    cashEnabled: boolean("cash_enabled").notNull().default(true),
    cashNote: text("cash_note"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check("payment_settings_singleton", sql`${t.id} = 1`)],
);
