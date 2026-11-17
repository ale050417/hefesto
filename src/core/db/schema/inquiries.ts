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
import { profiles } from "./profiles";

// Consultas (pedido de Ale, 2026-11-17): atención al cliente (Antonella) carga
// lo que pide una persona; el operador responde con el precio y los datos, y
// de ahí sale armado el mensaje para mandarle al cliente. Si el cliente
// acepta, atención al cliente la marca confirmada.
// Los nombres (`createdByName`, `answeredByName`) son snapshots: la consulta
// se sigue entendiendo aunque la cuenta se borre.
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    quantity: integer("quantity").notNull().default(1),
    // Fotos de referencia (bucket de imágenes, prefijo consultas/).
    images: jsonb("images").$type<string[]>().notNull().default([]),
    // pending | answered | confirmed | cancelled
    status: text("status").notNull().default("pending"),
    // --- Respuesta del operador ---
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    bulkPrice: numeric("bulk_price", { precision: 12, scale: 2 }),
    bulkFrom: integer("bulk_from"),
    dimensions: text("dimensions"),
    colors: text("colors"),
    deliveryTime: text("delivery_time"),
    answerNote: text("answer_note"),
    // Mensaje final para el cliente (armado solo, editable por el operador).
    message: text("message"),
    answeredBy: uuid("answered_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    answeredByName: text("answered_by_name"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "inquiries_status_valid",
      sql`${t.status} IN ('pending', 'answered', 'confirmed', 'cancelled')`,
    ),
    check("inquiries_quantity_positive", sql`${t.quantity} > 0`),
    index("inquiries_status_idx").on(t.status, t.createdAt),
  ],
);
