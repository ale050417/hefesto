import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customRequestStatus } from "./enums";
import { profiles } from "./profiles";

// Solicitudes de pedidos "a medida" (presupuesto custom).
export const customRequests = pgTable(
  "custom_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: los pedidos a medida de INVITADO (sin login) no tienen cuenta.
    customerId: uuid("customer_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    // Datos de contacto del invitado (cuando no hay cuenta). La charla sigue por WhatsApp.
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    guestEmail: text("guest_email"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    referenceImageUrl: text("reference_image_url"),
    // Presupuesto estimado que carga el propio cliente al pedir (orientativo).
    budget: numeric("budget", { precision: 12, scale: 2 }),
    status: customRequestStatus("status").notNull().default("pending"),
    quotedAmount: numeric("quoted_amount", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("custom_requests_customer_idx").on(t.customerId)],
);
