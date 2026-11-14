import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { getCoupon, toggleCoupon } from "@/features/discounts/queries";
import { isUuid } from "@/lib/ids";

/**
 * PATCH /api/v1/admin/descuentos/:id/estado — activa o pausa un cupón
 * (2026-10-31). Permiso descuentos/editar; igual que `toggleCouponAction`
 * (sin auditoría, como la web) y revalida /admin/descuentos.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ isActive: z.boolean() });

export const PATCH = withApi(
  "admin/descuentos/estado",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "descuentos", "editar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", "No encontramos el cupón.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("invalid", "Estado inválido.");

    if (!(await getCoupon(id))) {
      return apiError("not_found", "No encontramos el cupón.");
    }
    await toggleCoupon(id, parsed.data.isActive);
    revalidatePath("/admin/descuentos");
    return apiOk({ ok: true, isActive: parsed.data.isActive });
  },
);
