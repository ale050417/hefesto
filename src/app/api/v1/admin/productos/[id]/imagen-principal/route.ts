import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { revalidateProductImages } from "@/features/products/admin-revalidate";
import {
  getProductRow,
  listProductImages,
  makeImagePrimary,
} from "@/features/products/services/catalogService";

/**
 * POST /api/v1/admin/productos/:id/imagen-principal — elige cuál de las fotos YA
 * cargadas es la portada del producto (2026-10-31). Body: { imageId }.
 * Permiso productos/editar, igual que `setPrimaryImageAction`. No sube archivos.
 * A diferencia de la Server Action, acá se verifica que la foto sea de ESTE
 * producto (si no, el producto quedaba sin portada).
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const bodySchema = z.object({ imageId: z.uuid() });

export const POST = withApi(
  "admin/productos/imagen-principal",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("invalid", "Foto inválida.");

    const product = await getProductRow(id.data);
    if (!product) return apiError("not_found", "No encontramos el producto.");
    const images = await listProductImages(id.data);
    if (!images.some((i) => i.id === body.data.imageId)) {
      return apiError("not_found", "Esa foto no es de este producto.");
    }

    await makeImagePrimary(id.data, body.data.imageId);
    revalidateProductImages(id.data, product.slug);
    return apiOk({ ok: true });
  },
);
