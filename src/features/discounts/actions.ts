"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { rateLimit } from "@/core/security/rate-limit";
import { getClientIp } from "@/core/security/request";
import * as queries from "./queries";
import { saveCoupon } from "./save-coupon";
import { validateCoupon } from "./service";

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

/** Público (🌐): valida un código contra el subtotal. Rate-limited por IP. */
export async function validateCouponAction(
  code: string,
  subtotal: number,
): Promise<
  { ok: true; code: string; discount: number } | { ok: false; error: string }
> {
  const ip = await getClientIp();
  if (!(await rateLimit(`coupon:${ip}`, { limit: 20, windowMs: 60_000 })).ok) {
    return { ok: false, error: "Demasiados intentos. Esperá un momento." };
  }
  const coupon = await queries.getCouponByCode(code);
  if (!coupon) return { ok: false, error: "El cupón no existe." };
  // Cumpleaños del cliente logueado (para el cupón de cumple). El scope
  // producto/categoría se calcula exacto en el servidor al crear el pedido;
  // en el preview el descuento es sobre el subtotal (estimado).
  const user = await getCurrentUser();
  const result = validateCoupon(coupon, {
    subtotal,
    customerBirthDate: user?.profile?.birthDate ?? null,
  });
  if (!result.valid) return { ok: false, error: result.reason };
  return { ok: true, code: coupon.code, discount: result.discount };
}

export async function saveCouponAction(
  input: unknown,
  id?: string,
): Promise<ActionResult> {
  if (!(await can("descuentos", id ? "editar" : "crear"))) return NOT_STAFF;
  const user = await getCurrentUser();
  try {
    // Validación + existencia de producto/categoría + persistencia + auditoría
    // compartidas con la API de la app: ver save-coupon.ts.
    await saveCoupon({ input, id, actorId: user?.id ?? null });
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
  if (!(await can("descuentos", "editar"))) return NOT_STAFF;
  try {
    await queries.toggleCoupon(id, isActive);
    revalidatePath("/admin/descuentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  if (!(await can("descuentos", "eliminar"))) return NOT_STAFF;
  const user = await getCurrentUser();
  try {
    await queries.deleteCoupon(id);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "coupon.deleted",
      entityType: "coupon",
      entityId: id,
    });
    revalidatePath("/admin/descuentos");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
