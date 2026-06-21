import * as repo from "./repository";
import type { CouponInput } from "./schemas";
import type { Coupon } from "./types";

function toDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  return repo.findByCode(code.trim().toUpperCase());
}

export async function listCoupons(): Promise<Coupon[]> {
  return repo.listCoupons();
}

export async function getCoupon(id: string): Promise<Coupon | null> {
  return repo.findCouponById(id);
}

function toValues(input: CouponInput) {
  return {
    code: input.code,
    type: input.type,
    value: String(input.value),
    minPurchase: String(input.minPurchase ?? 0),
    maxUses: input.maxUses ?? null,
    startsAt: toDate(input.startsAt),
    expiresAt: toDate(input.expiresAt),
    isActive: input.isActive ?? true,
  };
}

export async function addCoupon(input: CouponInput): Promise<Coupon> {
  return repo.insertCoupon(toValues(input));
}

export async function updateCoupon(
  id: string,
  input: CouponInput,
): Promise<Coupon> {
  return repo.updateCouponRow(id, toValues(input));
}

export async function toggleCoupon(
  id: string,
  isActive: boolean,
): Promise<Coupon> {
  return repo.updateCouponRow(id, { isActive });
}
