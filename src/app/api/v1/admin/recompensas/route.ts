import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { appErrorResponse, invalidBody } from "@/core/api/validate";
import { listProductsAdmin } from "@/features/products/services/catalogService";
import {
  programInfo,
  redemptionToJson,
  rewardInputProblem,
  rewardToJson,
  sortRewards,
} from "@/features/rewards/admin-api";
import { rewardSchema } from "@/features/rewards/schemas";
import {
  createReward,
  getRewardsStats,
  listRecentRedemptions,
  listRewards,
} from "@/features/rewards/service";
import { loadOrThrow } from "@/lib/safe-load";

/**
 * /api/v1/admin/recompensas — módulo Recompensas de la app (2026-10-31).
 *
 * GET  (recompensas/ver): reglas del programa de puntos, estadísticas globales,
 *      catálogo (de menor a mayor costo), productos publicados para elegir el
 *      regalo y los últimos canjes. Mismas fuentes que /admin/recompensas.
 * POST (recompensas/crear): crea una recompensa. Mismo schema y efectos que
 *      `createRewardAction`.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/recompensas", async (request: Request) => {
  const auth = await requireApiPerm(request, "recompensas", "ver");
  if ("response" in auth) return auth.response;

  const [rewards, stats, productsPage, redemptions] = await loadOrThrow(
    "api:recompensas",
    Promise.all([
      listRewards(),
      getRewardsStats(),
      listProductsAdmin({ page: 1, pageSize: 500 }),
      listRecentRedemptions(30),
    ]),
  );
  const products = productsPage.items
    .filter((p) => p.status === "published")
    .map((p) => ({ id: p.id, name: p.name }));
  const names = new Map(products.map((p) => [p.id, p.name]));

  return apiOk({
    program: programInfo(),
    stats,
    rewards: sortRewards(rewards).map((r) => rewardToJson(r, names)),
    products,
    recentRedemptions: redemptions.map(redemptionToJson),
  });
});

export const POST = withApi(
  "admin/recompensas/crear",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "recompensas", "crear");
    if ("response" in auth) return auth.response;

    const parsed = rewardSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidBody(parsed.error);
    const problem = rewardInputProblem(parsed.data);
    if (problem) return apiError("invalid", problem);

    try {
      const created = await createReward(parsed.data);
      revalidatePath("/admin/recompensas");
      return apiOk({ id: created.id }, { status: 201 });
    } catch (error) {
      const res = appErrorResponse(error);
      if (res) return res;
      throw error;
    }
  },
);
