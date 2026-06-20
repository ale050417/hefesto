import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { profiles } from "./profiles";

// Favoritos del cliente (Cap. 10). unique(customer, product); cada cliente lo suyo.
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("wishlist_customer_product_unique").on(
      t.customerId,
      t.productId,
    ),
    index("wishlist_customer_idx").on(t.customerId),
  ],
);
