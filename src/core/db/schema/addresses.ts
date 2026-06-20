import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Direcciones de envío del cliente (Cap. 10). Cada cliente las suyas (RLS).
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name"),
    phone: text("phone"),
    street: text("street").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);
