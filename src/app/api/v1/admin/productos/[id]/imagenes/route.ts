import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { readImageUpload } from "@/core/api/upload";
import { revalidateProductImages } from "@/features/products/admin-revalidate";
import {
  addProductImage,
  getProductRow,
  listProductImages,
} from "@/features/products/services/catalogService";

/**
 * POST /api/v1/admin/productos/:id/imagenes — sube UNA foto al producto desde
 * la app (2026-11-17). Multipart: `file` y, opcional, `color` (a qué color o
 * combinación corresponde). Permiso productos/editar y tope de 5 fotos, igual
 * que la web. La primera foto queda como portada. Devuelve `{ id, url }`.
 */
export const dynamic = "force-dynamic";

const MAX_IMAGES = 5;

export const POST = withApi(
  "admin/productos/imagenes",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");
    const upload = await readImageUpload(request);
    if ("response" in upload) return upload.response;

    const product = await getProductRow(id.data);
    if (!product) return apiError("not_found", "No encontramos el producto.");
    if ((await listProductImages(id.data)).length >= MAX_IMAGES) {
      return apiError("invalid", `Máximo ${MAX_IMAGES} fotos por producto.`);
    }
    const colorRaw = upload.form.get("color");
    const color =
      typeof colorRaw === "string" && colorRaw.trim().length > 0
        ? colorRaw.trim().slice(0, 120)
        : null;
    const image = await addProductImage(
      id.data,
      upload.bytes,
      "50% 50%",
      "1",
      color,
    );
    revalidateProductImages(id.data, product.slug);
    return apiOk({ id: image.id, url: image.url }, { status: 201 });
  },
);
