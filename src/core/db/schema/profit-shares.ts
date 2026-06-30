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

// Socios y su porcentaje de reparto de la ganancia pura ("Ganancias y socios").
export const profitShares = pgTable(
  "profit_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: text("role"),
    pct: numeric("pct", { precision: 5, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("profit_shares_pct_range", sql`${t.pct} >= 0 AND ${t.pct} <= 100`),
  ],
);
