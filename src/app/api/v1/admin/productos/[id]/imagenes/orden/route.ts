import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { revalidateProductImages } from "@/features/products/admin-revalidate";
import {
  getProductRow,
  listProductImages,
  reorderProductImages,
} from "@/features/products/services/catalogService";
import { isSameSet } from "@/lib/image-frame";

/**
 * PUT /api/v1/admin/productos/:id/imagenes/orden — orden de las fotos del
 * producto (pedido de Ale, 2026-11-18: en la app se arrastran). Body:
 * `{ ids }` con TODAS las fotos en el orden nuevo. Permiso productos/editar.
 * No cambia cuál es la portada: eso sigue siendo "Usar como portada".
 */
export const dynamic = "force-dynamic";

const bodySchema = z.object({ ids: z.array(z.uuid()).min(1).max(50) });

export const PUT = withApi(
  "admin/productos/imagenes/orden",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("invalid", "Revisá el orden.");

    const product = await getProductRow(id.data);
    if (!product) return apiError("not_found", "No encontramos el producto.");
    const current = (await listProductImages(id.data)).map((i) => i.id);
    if (!isSameSet(current, body.data.ids)) {
      return apiError(
        "invalid",
        "Las fotos cambiaron mientras las ordenabas. Actualizá y probá de nuevo.",
      );
    }
    await reorderProductImages(id.data, body.data.ids);
    revalidateProductImages(id.data, product.slug);
    return apiOk({ ok: true });
  },
);
