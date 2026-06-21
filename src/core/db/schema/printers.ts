import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { printerStatus } from "./enums";

// Impresoras del taller.
export const printers = pgTable("printers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  model: text("model"),
  status: printerStatus("status").notNull().default("idle"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
