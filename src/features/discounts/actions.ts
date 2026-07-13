"use server";

import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
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
  // Si el cupón apunta a un producto/categoría, validamos que exista (Cap. 11).
  const d = parsed.data;
  if (d.scope && d.scope !== "all") {
    if (!d.targetId) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "Elegí el producto o la categoría.",
        },
      };
    }
    const cat = await import("@/features/products/services/catalogService");
    const exists =
      d.scope === "product"
        ? (await cat.getProductAdmin(d.targetId)) != null
        : (await cat.listCategoriesAdmin()).some((c) => c.id === d.targetId);
    if (!exists) {
      return {
        ok: false,
        error: {
          code: "VALIDATION",
          message: "El producto o categoría elegido no existe.",
        },
      };
    }
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
