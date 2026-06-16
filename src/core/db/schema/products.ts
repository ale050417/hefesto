import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { productStatus } from "./enums";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    material: text("material"),
    printTimeMinutes: integer("print_time_minutes"),
    weightGrams: integer("weight_grams"),
    dimensions: text("dimensions"),
    stock: integer("stock").notNull().default(0),
    status: productStatus("status").notNull().default("draft"),
    isFeatured: boolean("is_featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("products_price_positive", sql`${t.price} > 0`),
    check(
      "products_sale_price_lt_price",
      sql`${t.salePrice} IS NULL OR ${t.salePrice} < ${t.price}`,
    ),
    check("products_stock_non_negative", sql`${t.stock} >= 0`),
    index("products_slug_idx").on(t.slug),
    index("products_category_status_idx").on(t.categoryId, t.status),
    index("products_status_idx").on(t.status),
  ],
);
