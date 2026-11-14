import { revalidatePath } from "next/cache";
import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { recordAudit } from "@/core/audit";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { buildHexResolver } from "@/features/inventory/color-hex";
import {
  createFilamentWithHistory,
  listColorCatalog,
  listFilamentsView,
  toFilamentView,
} from "@/features/inventory/queries";
import { filamentSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments — gestión de filamentos para la app (2026-10-31).
 *  - GET  → stock de filamentos. Permiso filamentos/ver. Misma fuente que
 *           /admin/filamentos (el "bajo / agotado" sale de `listFilamentsView`,
 *           no se recalcula en la app). Cada fila lleva el `hex` del color
 *           (catálogo) para dibujar el carrete.
 *  - POST → alta de un carrete. Permiso filamentos/crear (igual que
 *           `saveFilamentAction` sin id). Mismo schema que la web.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/filaments", async (request: Request) => {
  const auth = await requireApiPerm(request, "filamentos", "ver");
  if ("response" in auth) return auth.response;

  const [filaments, colors] = await Promise.all([
    listFilamentsView(),
    // El catálogo de colores es decorativo: si falla, el stock igual se ve.
    listColorCatalog().catch(() => []),
  ]);
  const hexOf = buildHexResolver(colors);

  const items = filaments.map((f) => ({ ...f, hex: hexOf(f.color) }));

  return apiOk({
    items,
    counts: {
      total: items.length,
      low: items.filter((f) => f.status === "bajo").length,
      out: items.filter((f) => f.status === "agotado").length,
    },
    // Mismos totales que los KPI de la web (kg en stock y valor estimado).
    totals: {
      grams: items.reduce((a, f) => a + f.stockGrams, 0),
      value: items.reduce((a, f) => a + (f.stockGrams / 1000) * f.costPerKg, 0),
    },
  });
});

export const POST = withApi(
  "admin/filaments/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "crear");
    if ("response" in auth) return auth.response;

    const parsed = filamentSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    try {
      const created = await createFilamentWithHistory(parsed.data);
      await recordAudit({
        actorId: auth.user.id,
        action: "inventory.filament_created",
        entityType: "filament",
        entityId: created.id,
        metadata: {
          material: created.material,
          color: created.color,
          stockGrams: Number(created.stockGrams),
        },
      });
      revalidatePath("/admin/filamentos");
      const colors = await listColorCatalog().catch(() => []);
      return apiOk(
        {
          filament: {
            ...toFilamentView(created),
            hex: buildHexResolver(colors)(created.color),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
