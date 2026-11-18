import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { revalidateProductImages } from "@/features/products/admin-revalidate";
import {
  getProductRow,
  listProductImages,
  removeProductImage,
  setProductImagePosition,
} from "@/features/products/services/catalogService";
import { normalizePosition } from "@/lib/image-frame";

/**
 * PATCH /api/v1/admin/productos/:id/imagenes/:imageId — encuadre de una foto
 * (pedido de Ale, 2026-11-18: en la app se acomoda arrastrándola). Body:
 * `{ position }` = "x% y%", qué parte se ve cuando la tienda la recorta.
 *
 * DELETE /api/v1/admin/productos/:id/imagenes/:imageId — borra una foto del
 * producto desde la app (2026-11-17). Permiso productos/editar. Verifica que
 * la foto sea de ESTE producto. Si era la portada, pasa a serlo la siguiente.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; imageId: string }> };

export const DELETE = withApi(
  "admin/productos/imagenes/delete",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;
    const params = await ctx.params;
    const id = z.uuid().safeParse(params.id);
    const imageId = z.uuid().safeParse(params.imageId);
    if (!id.success || !imageId.success) {
      return apiError("invalid", "Foto inválida.");
    }
    const product = await getProductRow(id.data);
    if (!product) return apiError("not_found", "No encontramos el producto.");
    const images = await listProductImages(id.data);
    if (!images.some((i) => i.id === imageId.data)) {
      return apiError("not_found", "Esa foto no es de este producto.");
    }
    await removeProductImage(imageId.data);
    revalidateProductImages(id.data, product.slug);
    return apiOk({ ok: true });
  },
);

export const PATCH = withApi(
  "admin/productos/imagenes/patch",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;
    const params = await ctx.params;
    const id = z.uuid().safeParse(params.id);
    const imageId = z.uuid().safeParse(params.imageId);
    if (!id.success || !imageId.success) {
      return apiError("invalid", "Foto inválida.");
    }
    const raw = (await request.json().catch(() => null)) as {
      position?: unknown;
    } | null;
    const position = normalizePosition(raw?.position);
    if (!position) return apiError("invalid", "Encuadre inválido.");

    const product = await getProductRow(id.data);
    if (!product) return apiError("not_found", "No encontramos el producto.");
    const images = await listProductImages(id.data);
    if (!images.some((i) => i.id === imageId.data)) {
      return apiError("not_found", "Esa foto no es de este producto.");
    }
    await setProductImagePosition(imageId.data, position);
    revalidateProductImages(id.data, product.slug);
    return apiOk({ ok: true });
  },
);
