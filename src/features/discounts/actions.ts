"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { type ActionResult, toActionError } from "@/core/errors";
import { rateLimit } from "@/core/security/rate-limit";
import { getClientIp } from "@/core/security/request";
import * as queries from "./queries";
import { couponSchema } from "./schemas";
import { validateCoupon } from "./service";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Público (🌐): valida un código contra el subtotal. Rate-limited por IP. */
export async function validateCouponAction(
  code: string,
  subtotal: number,
): Promise<
  { ok: true; code: string; discount: number } | { ok: false; error: string }
> {
  const ip = await getClientIp();
  if (!rateLimit(`coupon:${ip}`, { limit: 20, windowMs: 60_000 }).ok) {
    return { ok: false, error: "Demasiados intentos. Esperá un momento." };
  }
  const coupon = await queries.getCouponByCode(code);
  if (!coupon) return { ok: false, error: "El cupón no existe." };
  const result = validateCoupon(coupon, subtotal);
  if (!result.valid) return { ok: false, error: result.reason };
  return { ok: true, code: coupon.code, discount: result.discount };
}

export async function saveCouponAction(
  input: unknown,
  id?: string,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  try {
    if (id) await queries.updateCoupon(id, parsed.data);
    else await queries.addCoupon(parsed.data);
    await recordAudit({
      actorId: user?.id ?? null,
      action: id ? "coupon.updated" : "coupon.created",
      entityType: "coupon",
      entityId: id ?? null,
      metadata: { code: parsed.data.code },
    });
    revalidatePath("/admin/descuentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function toggleCouponAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  if (!(await isStaff())) return NOT_STAFF;
  try {
    await queries.toggleCoupon(id, isActive);
    revalidatePath("/admin/descuentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
