import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import { buildHexResolver } from "@/features/inventory/color-hex";
import {
  adjustStock,
  getFilament,
  listColorCatalog,
  toFilamentView,
} from "@/features/inventory/queries";
import { stockAdjustSchema } from "@/features/inventory/schemas";

/**
 * POST /api/v1/admin/filaments/:id/adjust — ajuste manual de stock (app móvil,
 * 2026-10-31). Permiso filamentos/editar (el mismo que "sumar carrete" en la
 * web). Body: `{ deltaGrams }` (con signo) o `{ newStockGrams }` (stock contado)
 * + `reason` opcional. Pasa por el ledger (reason 'adjust'): queda en el
 * historial del carrete, avisa si quedó bajo el umbral y el motivo va a
 * auditoría. No deja el stock en negativo.
 */
export const dynamic = "force-dynamic";

export const POST = withApi(
  "admin/filaments/adjust",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;

    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Filamento inválido.");

    const parsed = stockAdjustSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    const { reason, ...input } = parsed.data;

    try {
      const result = await adjustStock(id.data, input, {
        reason,
        actorId: auth.user.id,
      });
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
