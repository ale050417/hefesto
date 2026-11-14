import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { AppError } from "@/core/errors";
import { costSettingsSchema } from "@/features/earnings/schemas";
import { getCostSettings, saveCostSettings } from "@/features/earnings/service";

/**
 * PUT /api/v1/admin/ganancias/costos — configuración de costos (kWh, watts,
 * vida útil y mantenimiento de la máquina) que usa la amortización por pedido
 * (2026-10-31). Permiso ganancias/editar, igual que `saveCostSettingsAction`.
 * Es la misma fila `cost_settings` que usa la calculadora (el margen de error
 * de la calculadora no se toca desde acá). Body: los 4 campos numéricos.
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/ganancias/costos",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "ganancias", "editar");
    if ("response" in auth) return auth.response;

    const parsed = costSettingsSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return apiError("invalid", "Revisá los valores.");

    try {
      await saveCostSettings(parsed.data);
      revalidatePath("/admin/ganancias");
      await recordAudit({
        actorId: auth.user.id,
        action: "cost_settings.updated",
        entityType: "cost_settings",
        metadata: { ...parsed.data, origen: "ganancias" },
      });
      return apiOk({ ok: true, settings: await getCostSettings() });
    } catch (error) {
      if (error instanceof AppError) {
        return apiError("invalid", error.message);
      }
      throw error;
    }
  },
);
