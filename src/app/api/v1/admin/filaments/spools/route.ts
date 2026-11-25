import { revalidatePath } from "next/cache";
import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import {
  listSpoolModelsView,
  saveSpoolModel,
} from "@/features/inventory/filament-types";
import { spoolModelSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/spools — modelos de carrete con su peso VACÍO, para
 * "Calcular filamento" (pedido de Agustín, 2026-11-24).
 *  - GET  → { items:[{id,name,emptyGrams}] }. Permiso filamentos/ver.
 *  - POST → crea uno ({ name, emptyGrams }). Permiso filamentos/editar.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/filaments/spools",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;
    return apiOk({ items: await listSpoolModelsView() });
  },
);

export const POST = withApi(
  "admin/filaments/spools/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const parsed = spoolModelSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const res = await saveSpoolModel(null, parsed.data);
      revalidatePath("/admin/filamentos");
      return apiOk({ ok: true, ...res }, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
