import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orderStatus, paymentMethod } from "./enums";
import { profiles } from "./profiles";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    // Cliente obligatorio: el checkout requiere cuenta. No se borra un cliente
    // con pedidos (restrict) para no perder el historial.
    customerId: uuid("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    shippingAddress: jsonb("shipping_address"),
    trackingCode: text("tracking_code"),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    check("orders_subtotal_non_negative", sql`${t.subtotal} >= 0`),
    check("orders_discount_non_negative", sql`${t.discountAmount} >= 0`),
    check("orders_total_non_negative", sql`${t.total} >= 0`),
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);
