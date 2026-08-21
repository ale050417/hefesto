import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { manualSales } from "./manual-sales";

/**
 * Líneas de una venta manual: UNA venta con VARIAS combinaciones de colores
 * (2026-08-09, pedido de Ale).
 *
 * El caso real: se venden 10 Dumplings, pero cada uno de una combinación de
 * colores distinta. Antes había que cargar 10 ventas separadas, porque
 * `manual_sales` asume "N unidades IDÉNTICAS" (un solo precio, un solo juego de
 * gramos, repetido `quantity` veces).
 *
 * Con esta tabla la venta sigue siendo UNA sola fila en Pedidos (fecha,
 * cliente, pago, estado), y adentro lleva el desglose: qué combinación, cuántas
 * de esa, a qué precio. El `total` y los gramos a descontar de la venta se
 * CALCULAN sumando estas líneas (ver `manualSaleTotals` / `consolidateGrams`).
 *
 * Las ventas simples (un producto de un solo color) NO usan esta tabla: siguen
 * exactamente como antes. Por eso todo esto es opt-in y nada viejo se rompe.
 */
export const manualSaleItems = pgTable(
  "manual_sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    manualSaleId: uuid("manual_sale_id")
      .notNull()
      .references(() => manualSales.id, { onDelete: "cascade" }),
    // Snapshot de qué se vendió (igual criterio que order_items): si mañana se
    // renombra la combinación en el catálogo, la venta conserva lo que fue.
    variantLabel: text("variant_label"),
    // Color elegido en productos de color único. En multicolor la combinación
    // ya viene en `variant_label` y esto queda null.
    color: text("color"),
    quantity: integer("quantity").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
    // Gramos por filamento de UNA unidad de esta combinación. El descuento de
    // stock multiplica por `quantity` de la línea (no por el de la venta).
    colorLines:
      jsonb("color_lines").$type<
        Array<{ filamentId: string; grams: number }>
      >(),
  },
  (t) => [
    check("manual_sale_items_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "manual_sale_items_unit_price_non_negative",
      sql`${t.unitPrice} >= 0`,
    ),
    index("manual_sale_items_sale_idx").on(t.manualSaleId),
  ],
);
