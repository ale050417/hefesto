import { sql } from "drizzle-orm";
import {
  check,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

// Variante = tamaño (ej. "Chica 10 cm" / "Grande 15 cm"), con su precio.
// Sin stock: los productos son a pedido.
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    priceOverride: numeric("price_override", { precision: 12, scale: 2 }),
  },
  (t) => [
    check(
      "variants_price_override_positive",
      sql`${t.priceOverride} IS NULL OR ${t.priceOverride} > 0`,
    ),
    uniqueIndex("variants_product_label_unique").on(t.productId, t.label),
    index("variants_product_idx").on(t.productId),
  ],
);
