import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { canForUser } from "@/core/auth/permissions";
import { respondBusinessError } from "@/features/products/admin-api-http";
import {
  archiveProductFlow,
  publishProductFlow,
} from "@/features/products/admin-flow";
import { revalidateProductCaches } from "@/features/products/admin-revalidate";
import { getProductRow } from "@/features/products/services/catalogService";

/**
 * POST /api/v1/admin/productos/:id/estado — publica o archiva un producto desde
 * la app (2026-10-31). Body: { status: "published" | "archived" }.
 *
 * Mismas reglas y permisos que la web (`publishProductAction` /
 * `archiveProductAction`):
 *  - published: permiso productos/editar; el producto necesita al menos una foto;
 *  - archived: permiso productos/eliminar (lo esconde de la tienda; se conserva
 *    y se puede volver a publicar).
 * El "activar / desactivar" rápido de la lista es esto.
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();
const bodySchema = z.object({ status: z.enum(["published", "archived"]) });

export const POST = withApi(
  "admin/productos/estado",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "productos", "ver");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Producto inválido.");
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("invalid", "Estado inválido.");
    const { status } = body.data;

    // Publicar = editar; archivar = eliminar (igual que las Server Actions).
    const needed = status === "published" ? "editar" : "eliminar";
    if (!(await canForUser(auth.user, "productos", needed))) {
      return apiError("forbidden", "No tenés permiso para hacer esto.");
    }

    const existing = await getProductRow(id.data);
    if (!existing) return apiError("not_found", "No encontramos el producto.");

    try {
      if (status === "published") {
        await publishProductFlow(auth.user.id, id.data);
      } else {
        await archiveProductFlow(auth.user.id, id.data);
      }
      revalidateProductCaches(existing.slug);
      return apiOk({ ok: true, status });
    } catch (error) {
      return respondBusinessError(error);
    }
  },
);
