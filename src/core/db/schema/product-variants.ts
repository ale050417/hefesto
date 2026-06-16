import { sql } from "drizzle-orm";
import {
  check,
  integer,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    priceOverride: numeric("price_override", { precision: 12, scale: 2 }),
    stock: integer("stock").notNull().default(0),
  },
  (t) => [check("variants_stock_non_negative", sql`${t.stock} >= 0`)],
);
