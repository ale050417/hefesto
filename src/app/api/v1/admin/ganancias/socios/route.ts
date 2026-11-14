import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { canForUser } from "@/core/auth/permissions";
import { recordAudit } from "@/core/audit";
import { AppError } from "@/core/errors";
import { planSharesChange } from "@/features/earnings/shares-plan";
import {
  applyProfitSharesPlan,
  listProfitShares,
} from "@/features/earnings/service";

/**
 * PUT /api/v1/admin/ganancias/socios — guarda el reparto de la ganancia entre
 * socios (2026-10-31). Toca plata, así que las reglas viven acá y no en la app:
 *  - permiso ganancias/editar (como `updateProfitShareAction`), más
 *    ganancias/crear si se suma un socio y ganancias/eliminar si se quita uno;
 *  - el reparto tiene que sumar 100% (misma regla que el editor web);
 *  - cada socio: nombre obligatorio, % entre 0 y 100 (`profitShareSchema`);
 *  - se guarda TODO junto en una transacción (la web va socio por socio);
 *  - si el reparto cambió desde otro dispositivo, se rechaza (no pisa nada).
 * Body: { shares: [{ id?, name, role?, pct }], removedIds?: string[] }
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  shares: z
    .array(
      z.object({
        id: z.uuid().nullish(),
        name: z.unknown(),
        role: z.unknown().optional(),
        pct: z.unknown(),
      }),
    )
    .max(50),
  removedIds: z.array(z.uuid()).max(50).default([]),
});

export const PUT = withApi(
  "admin/ganancias/socios",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "ganancias", "editar");
    if ("response" in auth) return auth.response;

    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success)
      return apiError("invalid", "Revisá los datos del reparto.");

    try {
      const current = await listProfitShares();
      const result = planSharesChange(
        current,
        body.data.shares,
        body.data.removedIds,
      );
      if (!result.ok) return apiError("invalid", result.message);
      const { plan } = result;

      if (
        plan.creates.length > 0 &&
        !(await canForUser(auth.user, "ganancias", "crear"))
      ) {
        return apiError("forbidden", "No tenés permiso para agregar socios.");
      }
      if (
        plan.deletes.length > 0 &&
        !(await canForUser(auth.user, "ganancias", "eliminar"))
      ) {
        return apiError("forbidden", "No tenés permiso para quitar socios.");
      }

      if (
        plan.creates.length > 0 ||
        plan.updates.length > 0 ||
        plan.deletes.length > 0
      ) {
        await applyProfitSharesPlan(plan);
        revalidatePath("/admin/ganancias");
        await recordAudit({
          actorId: auth.user.id,
          action: "profit_shares.updated",
          entityType: "profit_shares",
          metadata: {
            creados: plan.creates.length,
            editados: plan.updates.length,
            quitados: plan.deletes.length,
            total: plan.total,
          },
        });
      }
      // Devuelve el reparto ya guardado (con los ids de los socios nuevos).
      const saved = await listProfitShares();
      return apiOk({
        ok: true,
        shares: saved.map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          pct: Number(s.pct),
        })),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return apiError(
          error.code === "NOT_FOUND" ? "not_found" : "invalid",
          error.message,
        );
      }
      throw error;
    }
  },
);
