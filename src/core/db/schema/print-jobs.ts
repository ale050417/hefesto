import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { printJobStatus } from "./enums";
import { orders } from "./orders";
import { printers } from "./printers";

// Cola de trabajos de impresión.
export const printJobs = pgTable(
  "print_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    printerId: uuid("printer_id").references(() => printers.id, {
      onDelete: "set null",
    }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: printJobStatus("status").notNull().default("queued"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("print_jobs_printer_idx").on(t.printerId),
    index("print_jobs_status_idx").on(t.status),
  ],
);
