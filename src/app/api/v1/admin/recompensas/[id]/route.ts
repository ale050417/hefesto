import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import { rewardInputProblem } from "@/features/rewards/admin-api";
import { rewardSchema } from "@/features/rewards/schemas";
import {
  deleteReward,
  getReward,
  updateReward,
} from "@/features/rewards/service";
import { isUuid } from "@/lib/ids";

/**
 * /api/v1/admin/recompensas/:id (2026-10-31)
 *
 * PUT    (recompensas/editar): reemplaza los datos de la recompensa (el body es
 *        el mismo de la creación; `isActive` la activa o la pausa en la
 *        tienda). Igual que `updateRewardAction`.
 * DELETE (recompensas/eliminar): la borra del catálogo. Igual que
 *        `deleteRewardAction`.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NOT_FOUND = "No encontramos la recompensa.";

export const PUT = withApi(
  "admin/recompensas/editar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "recompensas", "editar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", NOT_FOUND);

    const parsed = rewardSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidBody(parsed.error);
    const problem = rewardInputProblem(parsed.data);
    if (problem) return apiError("invalid", problem);
    // Sin esto, editar una recompensa borrada (otro dispositivo) daría un 503.
    if (!(await getReward(id))) return apiError("not_found", NOT_FOUND);

    try {
      await updateReward(id, parsed.data);
      revalidatePath("/admin/recompensas");
      return apiOk({ ok: true });
    } catch (error) {
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);

export const DELETE = withApi(
  "admin/recompensas/eliminar",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "recompensas", "eliminar");
    if ("response" in auth) return auth.response;

    const { id } = await ctx.params;
    if (!isUuid(id)) return apiError("not_found", NOT_FOUND);

    await deleteReward(id);
    revalidatePath("/admin/recompensas");
    return apiOk({ ok: true });
  },
);
