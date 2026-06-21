import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { coupons } from "./coupons";
import { orders } from "./orders";
import { profiles } from "./profiles";

// Canjes de cupón (anti-abuso / auditoría de uso).
export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("coupon_redemptions_coupon_idx").on(t.couponId)],
);
