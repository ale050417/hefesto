import { sql } from "drizzle-orm";
import {
  check,
  index,
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
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    status: orderStatus("status").notNull().default("delivered"),
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
    index("manual_sales_date_idx").on(t.saleDate),
  ],
);
