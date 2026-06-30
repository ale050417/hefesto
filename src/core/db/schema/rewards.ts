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
import { rewardType } from "./enums";
import { products } from "./products";

// Catálogo de recompensas canjeables por puntos (lo que define el taller).
// El canje del cliente (generar cupón / producto gratis) es una fase aparte.
export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: rewardType("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    costPoints: integer("cost_points").notNull(),
    // discount: valor del descuento (+ si es %); product: producto de regalo.
    discountValue: numeric("discount_value", { precision: 12, scale: 2 }),
    discountIsPercent: boolean("discount_is_percent").notNull().default(false),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("rewards_cost_positive", sql`${t.costPoints} > 0`)],
);
