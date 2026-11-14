import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { canForUser } from "@/core/auth/permissions";
import {
  buildProductPatchRow,
  checkPatchPrices,
  definedPatch,
  fieldErrors,
  productPatchSchema,
  resolvePatchCosts,
  toAppProductDetail,
  validationMessage,
} from "@/features/products/admin-api";
import { respondBusinessError } from "@/features/products/admin-api-http";
import {
  computeProductCosts,
  deleteProductFlow,
  patchProductFlow,
} from "@/features/products/admin-flow";
import { revalidateProductCaches } from "@/features/products/admin-revalidate";
import {
  getCategoryAdmin,
  getProductAdmin,
  getProductRow,
  listCategoriesAdmin,
} from "@/features/products/services/catalogService";

/**
 * Un producto del panel de la app (2026-10-31).
 *  - GET    → ficha completa: datos, tamaños, precios por color e imágenes (solo
 *             lectura). Permiso productos/ver. Los costos (amortización,
 *             ganancia, insumos) solo si el usuario tiene ganancias/ver.
 *  - PATCH  → edición de los campos clave (nombre, descripción, categoría,
 *             precios, destacado, ficha técnica). Permiso productos/editar. Solo
 *             toca lo que se manda: no pisa tamaños, colores ni fotos.
 *  - DELETE → borra el producto DEFINITIVAMENTE (fotos, tamaños y reseñas; el
 *             historial de pedidos se conserva). Permiso productos/eliminar,
 *             igual que `deleteProductAction`.
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(
  "admin/productos/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "ver");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");

    const [data, categories, canSeeCosts] = await Promise.all([
      getProductAdmin(id.data),
      listCategoriesAdmin(),
      canForUser(auth.user, "ganancias", "ver"),
    ]);
    if (!data) return apiError("not_found", "No encontramos el producto.");

    return apiOk({
      product: toAppProductDetail({ ...data, categories, canSeeCosts }),
    });
  },
);

export const PATCH = withApi(
  "admin/productos/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");

    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return apiError("invalid", "Datos inválidos.");
    }
    const parsed = productPatchSchema.safeParse(body);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError("invalid", validationMessage(fields), { fields });
    }
    const patch = definedPatch(parsed.data);
    if (Object.keys(patch).length === 0) {
      return apiError("invalid", "No hay nada para actualizar.");
    }

    const existing = await getProductRow(id.data);
    if (!existing) return apiError("not_found", "No encontramos el producto.");

    // Regla de la oferta sobre el resultado final (parche + lo guardado).
    const priceError = checkPatchPrices(existing, patch);
    if (priceError) {
      return apiError("invalid", priceError, {
        fields: { salePrice: priceError },
      });
    }
    if (patch.categoryId && patch.categoryId !== existing.categoryId) {
      if (!(await getCategoryAdmin(patch.categoryId))) {
        return apiError("invalid", "La categoría elegida ya no existe.", {
          fields: { categoryId: "Elegí una categoría" },
        });
      }
    }

    // Amortización / ganancia: se recalculan si cambió el precio o la ficha técnica.
    const costs = await resolvePatchCosts({
      existing,
      patch,
      compute: computeProductCosts,
    });
    if (!costs.ok) {
      return apiError(
        "invalid",
        "No pudimos calcular el costo de producción. Elegí un material que tenga filamento cargado e indicá los gramos y el tiempo de impresión.",
      );
    }

    try {
      const row = { ...buildProductPatchRow(patch), ...costs.fields };
      const product = await patchProductFlow(auth.user.id, id.data, row);
      // Si cambió el slug, también hay que refrescar la ficha pública vieja.
      revalidateProductCaches(product.slug);
      if (existing.slug !== product.slug)
        revalidateProductCaches(existing.slug);
      return apiOk({ ok: true, id: product.id, slug: product.slug });
    } catch (error) {
      return respondBusinessError(error, "Ya existe un producto con ese slug.");
    }
  },
);

export const DELETE = withApi(
  "admin/productos/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "eliminar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");

    const existing = await getProductRow(id.data);
    if (!existing) return apiError("not_found", "No encontramos el producto.");

    try {
      await deleteProductFlow(auth.user.id, id.data);
      revalidateProductCaches(existing.slug);
      return apiOk({ ok: true });
    } catch (error) {
      return respondBusinessError(error);
    }
  },
);
