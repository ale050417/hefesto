import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import { deleteCoupon, getCoupon } from "@/features/discounts/queries";
import { saveCoupon } from "@/features/discounts/save-coupon";
import { couponSchema } from "@/features/discounts/schemas";
import { isUuid } from "@/lib/ids";

/**
 * /api/v1/admin/descuentos/:id (2026-10-31)
 *
 * PUT    (descuentos/editar): reemplaza los datos del cupón (el body es el
 *        mismo de la creación). Mismas reglas que `saveCouponAction`.
 * DELETE (descuentos/eliminar): borra el cupón y, por la FK, su historial de
 *        canjes. Igual que `deleteCouponAction` (auditoría `coupon.deleted`).
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "No encontramos el cupón.";

export const PUT = withApi(
  "admin/descuentos/editar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "descuentos", "editar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", NOT_FOUND);

    const body = await request.json().catch(() => null);
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);
    // Sin esto, editar un cupón borrado (otro dispositivo) fallaría con un 503.
    if (!(await getCoupon(id))) return apiError("not_found", NOT_FOUND);

    try {
      await saveCoupon({ input: body, id, actorId: auth.user.id });
      revalidatePath("/admin/descuentos");
      return apiOk({ ok: true });
    } catch (error) {
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/descuentos/eliminar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "descuentos", "eliminar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", NOT_FOUND);

    await deleteCoupon(id);
    await recordAudit({
      actorId: auth.user.id,
      action: "coupon.deleted",
      entityType: "coupon",
      entityId: id,
    });
    revalidatePath("/admin/descuentos");
    return apiOk({ ok: true });
  },
);
