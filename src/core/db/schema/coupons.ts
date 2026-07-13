import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { couponType } from "./enums";

// Cupones de descuento (Cap. 10 / Fase 8). El código es único.
export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    // Texto descriptivo opcional (se muestra en la card del panel).
    description: text("description"),
    type: couponType("type").notNull(),
    value: numeric("value", { precision: 12, scale: 2 }).notNull(),
    minPurchase: numeric("min_purchase", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    // A qué aplica: 'all' (todo el carrito) | 'product' | 'category'.
    scope: text("scope").notNull().default("all"),
    targetId: uuid("target_id"),
    targetLabel: text("target_label"),
    // Solo vale en la semana del cumpleaños del cliente logueado.
    birthdayOnly: boolean("birthday_only").notNull().default(false),
    maxUses: integer("max_uses"), // null = ilimitado
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("coupons_value_positive", sql`${t.value} > 0`),
    check("coupons_min_purchase_non_negative", sql`${t.minPurchase} >= 0`),
    check("coupons_used_count_non_negative", sql`${t.usedCount} >= 0`),
    check(
      "coupons_scope_valid",
      sql`${t.scope} IN ('all','product','category')`,
    ),
  ],
);
