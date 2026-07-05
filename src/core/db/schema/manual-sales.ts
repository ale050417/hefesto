import { sql } from "drizzle-orm";
import {
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
import { orderStatus, paymentMethod } from "./enums";
import { profiles } from "./profiles";

// Ventas manuales / históricas (mostrador o ventas previas al sistema).
// A diferencia de `orders` (cliente registrado + total recalculado + máquina de
// estados), esto es un registro libre: cliente por texto, total cargado a mano
// y estado a elección. Suma a la facturación pero NO usa el flujo de checkout.
export const manualSales = pgTable(
  "manual_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleDate: timestamp("sale_date", { withTimezone: true }).notNull(),
    customerName: text("customer_name").notNull(),
    detail: text("detail"),
    // Cantidad de unidades de la venta (fix auditoría 2026-07: antes 80
    // unidades se cargaban una por una o multiplicando a mano). El total es de
    // TODA la venta; la amortización guardada también (unitaria × cantidad).
    quantity: integer("quantity").notNull().default(1),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    // Costos cargados con la calculadora: amortización (costo) y ganancia
    // (total − amortización). La ganancia es lo que se reparte entre socios.
    amortization: numeric("amortization", { precision: 12, scale: 2 }),
    profit: numeric("profit", { precision: 12, scale: 2 }),
    paymentMethod: paymentMethod("payment_method").notNull(),
    status: orderStatus("status").notNull().default("delivered"),
    // Reparto de la ganancia de ESTA venta (foto del momento): [{nombre, pct}].
    // Si es null, se divide por los socios actuales (ver earnings).
    profitSplit:
      jsonb("profit_split").$type<Array<{ name: string; pct: number }>>(),
    // Quién la cargó (staff). Se conserva el historial si se borra el usuario.
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("manual_sales_total_positive", sql`${t.total} > 0`),
    check("manual_sales_quantity_positive", sql`${t.quantity} > 0`),
    index("manual_sales_date_idx").on(t.saleDate),
  ],
);
