import { recordAudit } from "@/core/audit";
import { ValidationError } from "@/core/errors";
import * as queries from "./queries";
import { couponSchema } from "./schemas";
import type { Coupon } from "./types";

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Crea (sin `id`) o edita (con `id`) un cupón CON todas sus reglas (2026-10-31,
 * pedido de Ale: app móvil). Antes vivía inline en `saveCouponAction`; se
 * extrajo para que la web (Server Action) y la API de la app
 * (`/api/v1/admin/descuentos`) validen y auditen EXACTAMENTE igual:
 *  - schema zod (`couponSchema`);
 *  - si apunta a un producto/categoría, que exista (Cap. 11);
 *  - persistencia + auditoría (`coupon.created` / `coupon.updated`).
 *
 * La AUTORIZACIÓN (descuentos/crear o editar) la valida cada caller antes de
 * llamar acá. Los errores de validación salen como `ValidationError` (con
 * `fields` para el formulario web); el caller decide cómo mostrarlos. El
 * `revalidatePath` también queda del lado del caller.
 */
export async function saveCoupon(params: {
  input: unknown;
  id?: string;
  actorId: string | null;
}): Promise<Coupon> {
  const { input, id, actorId } = params;
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Revisá los datos.", fieldErrors(parsed.error));
  }
  // Si el cupón apunta a un producto/categoría, validamos que exista (Cap. 11).
  const d = parsed.data;
  if (d.scope && d.scope !== "all") {
    if (!d.targetId) {
      throw new ValidationError("Elegí el producto o la categoría.");
    }
    const cat = await import("@/features/products/services/catalogService");
    const exists =
      d.scope === "product"
        ? (await cat.getProductAdmin(d.targetId)) != null
        : (await cat.listCategoriesAdmin()).some((c) => c.id === d.targetId);
    if (!exists) {
      throw new ValidationError("El producto o categoría elegido no existe.");
    }
  }
  const saved = id
    ? await queries.updateCoupon(id, parsed.data)
    : await queries.addCoupon(parsed.data);
  await recordAudit({
    actorId,
    action: id ? "coupon.updated" : "coupon.created",
    entityType: "coupon",
    entityId: id ?? null,
    metadata: { code: parsed.data.code },
  });
  return saved;
}
