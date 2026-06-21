import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { profiles } from "./profiles";

// Chat de un pedido (cliente ↔ taller).
export const orderMessages = pgTable(
  "order_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStaff: boolean("from_staff").notNull().default(false),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_messages_order_idx").on(t.orderId)],
);
