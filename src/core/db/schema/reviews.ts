import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { profiles } from "./profiles";

// Reseñas de productos (rating 1-5). Se moderan antes de mostrarse.
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name"),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("reviews_rating_range", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
    uniqueIndex("reviews_product_customer_unique").on(
      t.productId,
      t.customerId,
    ),
    index("reviews_product_idx").on(t.productId),
  ],
);
