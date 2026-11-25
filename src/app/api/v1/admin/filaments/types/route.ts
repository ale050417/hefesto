import { revalidatePath } from "next/cache";
import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { businessError, invalidInput } from "@/features/inventory/api-helpers";
import {
  listFilamentTypesView,
  listSpoolModelsView,
  saveFilamentType,
} from "@/features/inventory/filament-types";
import { filamentTypeSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/types — tipos de filamento con su precio por kg
 * (pedido de Agustín, 2026-11-24: "cambiar el precio en un solo lugar y no en
 * los 32 carretes").
 *  - GET  → { types:[{id,name,costPerKg,spools}], spoolModels:[{id,name,
 *           emptyGrams}] }. Permiso filamentos/ver. Trae también los modelos
 *           de carrete para no hacer dos pedidos al abrir Filamentos.
 *  - POST → crea un tipo ({ name, costPerKg }). Permiso filamentos/editar.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/filaments/types",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;
    const [types, spoolModels] = await Promise.all([
      listFilamentTypesView(),
      listSpoolModelsView(),
    ]);
    return apiOk({ types, spoolModels });
  },
);

export const POST = withApi(
  "admin/filaments/types/create",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "editar");
    if ("response" in auth) return auth.response;
    const parsed = filamentTypeSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    try {
      const res = await saveFilamentType(null, parsed.data, auth.user.id);
      revalidatePath("/admin/filamentos");
      return apiOk({ ok: true, ...res }, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
