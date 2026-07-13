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
    customerId: uuid("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
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
