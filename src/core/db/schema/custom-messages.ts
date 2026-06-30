import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customRequests } from "./custom-requests";
import { profiles } from "./profiles";

// Chat de un pedido a medida (cliente ↔ taller).
export const customMessages = pgTable(
  "custom_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => customRequests.id, { onDelete: "cascade" }),
    fromStaff: boolean("from_staff").notNull().default(false),
    authorId: uuid("author_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull().default(""),
    // Foto adjunta opcional (URL pública en el bucket de storage).
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("custom_messages_request_idx").on(t.requestId)],
);
