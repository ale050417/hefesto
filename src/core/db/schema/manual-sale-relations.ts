import { relations } from "drizzle-orm";
import { manualSaleItems } from "./manual-sale-items";
import { manualSales } from "./manual-sales";

// Una venta manual puede tener líneas (varias combinaciones de colores en la
// MISMA venta). Sin líneas = venta simple de siempre (N unidades idénticas).
export const manualSalesRelations = relations(manualSales, ({ many }) => ({
  items: many(manualSaleItems),
}));

export const manualSaleItemsRelations = relations(
  manualSaleItems,
  ({ one }) => ({
    sale: one(manualSales, {
      fields: [manualSaleItems.manualSaleId],
      references: [manualSales.id],
    }),
  }),
);
