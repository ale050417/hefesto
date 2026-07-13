import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    // Encuadre (object-position CSS, ej. "50% 30%") para acomodar el recorte.
    position: text("position").notNull().default("50% 50%"),
    // Zoom (factor de scale del transform, 1 = normal). Alejar <1 / acercar >1.
    scale: numeric("scale", { precision: 4, scale: 2 }).notNull().default("1"),
  },
  (t) => [
    // Una sola imagen principal por producto (índice único parcial).
    uniqueIndex("images_one_primary_per_product")
      .on(t.productId)
      .where(sql`${t.isPrimary}`),
    index("images_product_idx").on(t.productId),
  ],
);
