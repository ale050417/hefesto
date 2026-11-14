import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  buildCategoryPatchCandidate,
  fieldErrors,
  validationMessage,
} from "@/features/products/admin-api";
import { respondBusinessError } from "@/features/products/admin-api-http";
import {
  deleteCategoryFlow,
  updateCategoryFlow,
} from "@/features/products/admin-flow";
import { revalidateCategoryCaches } from "@/features/products/admin-revalidate";
import { categoryInputSchema } from "@/features/products/schemas";
import { getCategoryAdmin } from "@/features/products/services/catalogService";

/**
 * Una categoría del panel de la app (2026-10-31). Módulo de permisos `productos`.
 *  - PATCH  → edita nombre, ícono, color, padre (`parentId`, null = raíz) y/o
 *             orden. Permiso productos/editar. Solo toca lo que se manda; el slug
 *             se conserva al renombrar. Valida el ciclo del árbol como la web.
 *  - DELETE → borra. Permiso productos/eliminar. Mismas reglas que la web: sin
 *             productos y sin subcategorías (si no, 422 con el motivo).
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(
  "admin/categorias/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "editar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Categoría inválida.");

    const existing = await getCategoryAdmin(id.data);
    if (!existing) return apiError("not_found", "No encontramos la categoría.");

    const merged = buildCategoryPatchCandidate(
      existing,
      await request.json().catch(() => null),
    );
    if (!merged) return apiError("invalid", "Datos inválidos.");
    if (merged.changed.length === 0) {
      return apiError("invalid", "No hay nada para actualizar.");
    }

    const parsed = categoryInputSchema.safeParse(merged.candidate);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      return apiError("invalid", validationMessage(fields), { fields });
    }

    try {
      const category = await updateCategoryFlow(
        auth.user.id,
        id.data,
        parsed.data,
      );
      revalidateCategoryCaches();
      return apiOk({ ok: true, id: category.id });
    } catch (error) {
      return respondBusinessError(
        error,
        "Ya existe una categoría con ese nombre o slug.",
      );
    }
  },
);

export const DELETE = withApi(
  "admin/categorias/id",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "productos", "eliminar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Categoría inválida.");

    if (!(await getCategoryAdmin(id.data))) {
      return apiError("not_found", "No encontramos la categoría.");
    }

    try {
      await deleteCategoryFlow(auth.user.id, id.data);
      revalidateCategoryCaches();
      return apiOk({ ok: true });
    } catch (error) {
      return respondBusinessError(error);
    }
  },
);
