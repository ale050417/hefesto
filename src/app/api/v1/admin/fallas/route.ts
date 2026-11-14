import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { buildHexResolver } from "@/features/inventory/color-hex";
import { FAIL_REASONS } from "@/features/inventory/constants";
import { registerFailureFlow } from "@/features/inventory/failure-flow";
import { buildFailuresView } from "@/features/inventory/failures-view";
import {
  listColorCatalog,
  listFailures,
  listFilamentsView,
} from "@/features/inventory/queries";
import { failureSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/fallas — impresiones fallidas para la app (2026-10-31).
 *  - GET  → listado (las últimas 200, como la web) con costo estimado por
 *           falla, resumen (cantidad, gramos, costo, causa más común) y las
 *           opciones del alta (carretes con su stock, materiales y causas).
 *           Permiso fallas/ver. Los carretes viajan acá porque quien registra
 *           fallas puede no tener permiso sobre el módulo de filamentos
 *           (igual que la página web, que los carga con el permiso de fallas).
 *  - POST → registra una falla. Permiso fallas/crear (igual que
 *           `registerFailureAction`). Descuenta por el ledger cada carrete de
 *           `colorLines` (multicolor); si a alguno no le alcanza, igual queda
 *           registrada y se avisa al panel. Mismo schema que la web.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/fallas", async (request: Request) => {
  const auth = await requireApiPerm(request, "fallas", "ver");
  if ("response" in auth) return auth.response;

  const [filaments, failures, colors] = await Promise.all([
    listFilamentsView(),
    listFailures(),
    listColorCatalog().catch(() => []),
  ]);
  const hexOf = buildHexResolver(colors);
  const { items, summary } = buildFailuresView(failures, filaments);

  return apiOk({
    items: items.map((i) => ({ ...i, hex: hexOf(i.color) })),
    summary,
    filaments: filaments.map((f) => ({
      id: f.id,
      material: f.material,
      color: f.color,
      brand: f.brand,
      stockGrams: f.stockGrams,
      hex: hexOf(f.color),
    })),
    materials: [...new Set(filaments.map((f) => f.material))],
    reasons: FAIL_REASONS,
  });
});

export const POST = withApi("admin/fallas/create", async (request: Request) => {
  const auth = await requireApiPerm(request, "fallas", "crear");
  if ("response" in auth) return auth.response;

  const parsed = failureSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const res = await registerFailureFlow(parsed.data, auth.user.id);
    return apiOk(res, { status: 201 });
  } catch (error) {
    const mapped = businessError(error);
    if (mapped) return mapped;
    throw error;
  }
});
