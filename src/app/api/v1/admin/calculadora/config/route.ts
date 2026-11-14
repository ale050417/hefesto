import { revalidatePath } from "next/cache";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { calcConfigSchema } from "@/features/calculator/schemas";
import { getCalcConfig, saveCalcConfig } from "@/features/calculator/service";

/**
 * PUT /api/v1/admin/calculadora/config — configuración global de costos
 * (kWh, watts, vida útil, mantenimiento y margen de error) (2026-10-31).
 * Permiso calculadora/editar, igual que `saveCalcConfigAction`. Es la misma
 * fila `cost_settings` que usa Ganancias, así que también revalida esa pantalla.
 */
export const dynamic = "force-dynamic";

export const PUT = withApi(
  "admin/calculadora/config",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "calculadora", "editar");
    if ("response" in auth) return auth.response;

    const parsed = calcConfigSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return apiError("invalid", "Revisá la configuración.");

    await saveCalcConfig(parsed.data);
    revalidatePath("/admin/calculadora");
    revalidatePath("/admin/ganancias");
    await recordAudit({
      actorId: auth.user.id,
      action: "cost_settings.updated",
      entityType: "cost_settings",
      metadata: { ...parsed.data, origen: "calculadora" },
    });
    return apiOk({ ok: true, config: await getCalcConfig() });
  },
);
