import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { productStatus } from "./enums";

// Productos a pedido (made-to-order): NO tienen stock.
// La disponibilidad se controla con `status`; el inventario real es el
// filamento por color (gramos), que se modela en la Fase 7.
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    // Categoría obligatoria; no se puede borrar una categoría en uso (restrict).
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    salePrice: numeric("sale_price", { precision: 12, scale: 2 }),
    // Costos del producto (cargados con la calculadora al crear/editar).
    // amortization = costo de producir; profit = precio − amortización.
    amortization: numeric("amortization", { precision: 12, scale: 2 }),
    profit: numeric("profit", { precision: 12, scale: 2 }),
    // Costo de los insumos del producto (vaso, argollas, etc.). SEPARADO del
    // precio: el precio ya los incluye (se cobran), pero este monto se descuenta
    // en la amortización del pedido para que el insumo no infle la ganancia.
    extrasCost: numeric("extras_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    material: text("material"),
    printTimeMinutes: integer("print_time_minutes"),
    weightGrams: integer("weight_grams"),
    dimensions: text("dimensions"),
    // Ficha técnica 3D (paridad index)
    colorMode: text("color_mode").notNull().default("single"),
    colors: jsonb("colors").$type<string[]>().notNull().default([]),
    colorPrices: jsonb("color_prices")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    layerHeight: text("layer_height"),
    infillPercent: integer("infill_percent"),
    productionTime: text("production_time"),
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
      "products_sale_price_valid",
      sql`${t.salePrice} IS NULL OR (${t.salePrice} > 0 AND ${t.salePrice} < ${t.price})`,
    ),
    check(
      "products_print_time_non_negative",
      sql`${t.printTimeMinutes} IS NULL OR ${t.printTimeMinutes} >= 0`,
    ),
    check(
      "products_weight_non_negative",
      sql`${t.weightGrams} IS NULL OR ${t.weightGrams} >= 0`,
    ),
    check(
      "products_infill_range",
      sql`${t.infillPercent} IS NULL OR (${t.infillPercent} >= 0 AND ${t.infillPercent} <= 100)`,
    ),
    check(
      "products_color_mode_valid",
      sql`${t.colorMode} IN ('single','multi')`,
    ),
    index("products_slug_idx").on(t.slug),
    index("products_category_status_idx").on(t.categoryId, t.status),
    index("products_status_idx").on(t.status),
  ],
);
