import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { buildHexResolver } from "@/features/inventory/color-hex";
import { weighFilament } from "@/features/inventory/filament-types";
import {
  getFilament,
  listColorCatalog,
  toFilamentView,
} from "@/features/inventory/queries";
import { weighSchema } from "@/features/inventory/schemas";

/**
 * POST /api/v1/admin/filaments/:id/weigh — "Calcular filamento" (pedido de
 * Agustín, 2026-11-24): se pesa el carrete en uso y el servidor resta el peso
 * del carrete vacío. Body: { spoolModelId, totalGrams, sealedSpools? }
 * (`sealedSpools` = carretes cerrados del mismo color que se suman enteros).
 * Permiso filamentos/editar. Fija el stock por el ledger (queda en el
 * historial) y recuerda el modelo de carrete. Responde { remainingGrams,
 * newStockGrams, previousStock, changed, lowStock, filament }.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/filaments/weigh",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Filamento inválido.");

    const parsed = weighSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);

    try {
      const result = await weighFilament(id.data, parsed.data, auth.user.id);
      revalidatePath("/admin/filamentos");
      const f = await getFilament(id.data);
      const colors = await listColorCatalog().catch(() => []);
      return apiOk({
        ...result,
        filament: f
          ? { ...toFilamentView(f), hex: buildHexResolver(colors)(f.color) }
          : null,
      });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
