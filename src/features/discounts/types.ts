import type { coupons } from "@/core/db/schema";

export type Coupon = typeof coupons.$inferSelect;
export type CouponType = Coupon["type"];

// Subconjunto necesario para validar (facilita los tests).
export type CouponForValidation = Pick<
  Coupon,
  | "type"
  | "value"
  | "minPurchase"
  | "maxUses"
  | "usedCount"
  | "startsAt"
  | "expiresAt"
  | "isActive"
  | "scope"
  | "targetId"
  | "birthdayOnly"
>;
