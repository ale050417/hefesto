import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Avisos in-app. `audience` separa los del cliente (pedido confirmado, listo…)
// de los del ADMIN (pedido nuevo, stock bajo, mensaje de cliente). Las de admin
// son broadcast al staff, por eso `customerId` es nullable (0041).
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Destinatario: 'customer' (por cliente) | 'admin' (broadcast al staff).
    audience: text("audience").notNull().default("customer"),
    customerId: uuid("customer_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_customer_idx").on(t.customerId),
    index("notifications_audience_idx").on(t.audience, t.isRead),
  ],
);
