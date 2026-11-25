import { apiOk, withApi } from "@/core/api/respond";
import { requireCalcAccess } from "@/features/calculator/api-access";
import { isAdminForUser } from "@/core/auth/permissions";
import { buildCalcPayload } from "@/features/calculator/calc-payload";
import {
  getCalcConfig,
  getStats,
  listActivePresetOptions,
  listFilamentOptions,
  listHistory,
  listMarginPresets,
} from "@/features/calculator/service";
import { listColorCatalog } from "@/features/inventory/queries";

/**
 * GET /api/v1/admin/calculadora — todo lo que necesita la Calculadora 3D de la
 * app (2026-10-31): configuración de costos, filamentos elegibles (cada uno con
 * SU costo/kg), tipos de producto, historial de cálculos y estadísticas.
 * Permiso calculadora/ver. El margen es secreto de negocio: solo el ADMIN
 * recibe los tipos con su %, el costo total y la ganancia del historial; el
 * operador recibe nombres y precio final (igual que la página web).
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/calculadora", async (request: Request) => {
  const auth = await requireCalcAccess(request);
  if ("response" in auth) return auth.response;

  const admin = await isAdminForUser(auth.user);
  const [config, history, stats, filaments, presetOptions, presets, colors] =
    await Promise.all([
      getCalcConfig(),
      listHistory(),
      getStats(),
      listFilamentOptions(),
      listActivePresetOptions(),
      admin ? listMarginPresets() : Promise.resolve([]),
      // El catálogo de colores es decorativo: si falla, la calculadora sigue.
      listColorCatalog().catch(() => []),
    ]);

  const hexByColor = new Map(
    colors
      .filter((c) => c.hex)
      .map((c) => [c.name.trim().toLowerCase(), c.hex as string]),
  );

  return apiOk(
    buildCalcPayload({
      config,
      filaments: filaments.map((f) => ({
        ...f,
        hex: hexByColor.get(f.color.trim().toLowerCase()) ?? null,
      })),
      presetOptions,
      presets,
      history,
      stats,
      isAdmin: admin,
    }),
  );
});
