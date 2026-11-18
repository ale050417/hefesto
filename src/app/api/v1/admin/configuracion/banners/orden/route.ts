import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiOk, withApi } from "@/core/api/respond";
import { readBody, requireConfigEdit } from "@/features/settings/api-helpers";
import { getAllBanners, reorderBanners } from "@/features/settings/service";
import { isSameSet } from "@/lib/image-frame";

/**
 * PUT /api/v1/admin/configuracion/banners/orden — orden de los banners del
 * inicio (pedido de Ale, 2026-11-18: en la app se arrastran). Body:
 * `{ ids }` con TODOS los banners en el orden nuevo. Permiso config/editar.
 * Si la lista no coincide con los banners que hay (alguien sumó o borró uno
 * mientras tanto) no se reordena: la app recarga y se vuelve a arrastrar.
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) });

export const PUT = withApi(
  "admin/configuracion/banners/orden",
  async (request: Request) => {
    const auth = await requireConfigEdit(request);
    if ("response" in auth) return auth.response;
    const body = await readBody(request, bodySchema, "Revisá el orden.");
    if ("response" in body) return body.response;

    const current = (await getAllBanners()).map((b) => b.id);
    if (!isSameSet(current, body.data.ids)) {
      return apiError(
        "invalid",
        "Los banners cambiaron mientras los ordenabas. Actualizá y probá de nuevo.",
      );
    }
    await reorderBanners(body.data.ids);
    revalidatePath("/", "layout");
    revalidatePath("/admin/configuracion");
    return apiOk({ ok: true });
  },
);
