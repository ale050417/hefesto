import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  buildCategoryCreateCandidate,
  categorySummary,
  fieldErrors,
  toAppCategoryRows,
  validationMessage,
} from "@/features/products/admin-api";
import { respondBusinessError } from "@/features/products/admin-api-http";
import { createCategoryFlow } from "@/features/products/admin-flow";
import { revalidateCategoryCaches } from "@/features/products/admin-revalidate";
import { categoryInputSchema } from "@/features/products/schemas";
import { listCategoriesAdmin } from "@/features/products/services/catalogService";

/**
 * Categorías del panel de la app (2026-10-31). Comparten el módulo de permisos
 * `productos` con los productos (igual que en la web).
 *  - GET  → todas, en orden de árbol (cada una seguida de sus subcategorías) con
 *           profundidad, ruta y conteos de productos. Permiso productos/ver.
 *  - POST → crea una categoría o subcategoría (`parentId`). Permiso
 *           productos/crear. Body: { name, parentId?, icon?, color?, slug? }; el
 *           slug sale del nombre si no viene, como en el formulario web.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/categorias", async (request: Request) => {
  const auth = await requireApiPerm(request, "productos", "ver");
  if ("response" in auth) return auth.response;

  const categories = await listCategoriesAdmin();
  return apiOk({
    items: toAppCategoryRows(categories),
    summary: categorySummary(categories),
  });
});

export const POST = withApi("admin/categorias", async (request: Request) => {
  const auth = await requireApiPerm(request, "productos", "crear");
  if ("response" in auth) return auth.response;

  const candidate = buildCategoryCreateCandidate(
    await request.json().catch(() => null),
  );
  if (!candidate) return apiError("invalid", "Datos inválidos.");
  const parsed = categoryInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return apiError("invalid", validationMessage(fields), { fields });
  }

  try {
    const category = await createCategoryFlow(auth.user.id, parsed.data);
    revalidateCategoryCaches();
    return apiOk({ id: category.id, slug: category.slug }, { status: 201 });
  } catch (error) {
    return respondBusinessError(
      error,
      "Ya existe una categoría con ese nombre o slug.",
    );
  }
});
