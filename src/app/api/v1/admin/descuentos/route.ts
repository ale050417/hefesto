import { revalidatePath } from "next/cache";
import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import { couponCounts, couponToJson } from "@/features/discounts/admin-api";
import { listCoupons } from "@/features/discounts/queries";
import { saveCoupon } from "@/features/discounts/save-coupon";
import { couponSchema } from "@/features/discounts/schemas";
import { loadOrThrow } from "@/lib/safe-load";

/**
 * /api/v1/admin/descuentos — módulo Descuentos de la app (2026-10-31).
 *
 * GET  (descuentos/ver): cupones, más nuevos primero, con su estado
 *      (active|paused|expired) y usos. Misma fuente que /admin/descuentos.
 * POST (descuentos/crear): crea un cupón. Mismas reglas que
 *      `saveCouponAction` (compartidas en `saveCoupon`): schema, existencia del
 *      producto/categoría, auditoría `coupon.created` y revalidación.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/descuentos", async (request: Request) => {
  const auth = await requireApiPerm(request, "descuentos", "ver");
  if ("response" in auth) return auth.response;

  const coupons = await loadOrThrow("api:descuentos", listCoupons());
  const now = new Date();
  return apiOk({
    items: coupons.map((c) => couponToJson(c, now)),
    counts: couponCounts(coupons, now),
  });
});

export const POST = withApi(
  "admin/descuentos/crear",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "descuentos", "crear");
    if ("response" in auth) return auth.response;

    const body = await request.json().catch(() => null);
    // El schema se valida acá para devolver el mensaje puntual del campo; el
    // saveCoupon vuelve a validar (idempotente) y suma las reglas de negocio.
    const parsed = couponSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error);

    try {
      const saved = await saveCoupon({
        input: body,
        actorId: auth.user.id,
      });
      revalidatePath("/admin/descuentos");
      return apiOk({ id: saved.id }, { status: 201 });
    } catch (error) {
      // Error de negocio: "El producto o categoría elegido no existe.", etc.
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);
