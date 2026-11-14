import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listFilamentsView } from "@/features/inventory/queries";
import { toAppCategoryRows } from "@/features/products/admin-api";
import { listCategoriesAdmin } from "@/features/products/services/catalogService";

/**
 * GET /api/v1/admin/productos/opciones — lo que necesita el formulario de alta y
 * edición de la app (2026-10-31): categorías en orden de árbol (con la ruta
 * "Figuras › Funko Pop") y los materiales que tienen filamento cargado (el costo
 * de producción se calcula con ellos). Permiso productos/ver.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/productos/opciones",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "productos", "ver");
    if ("response" in auth) return auth.response;

    const [categories, filaments] = await Promise.all([
      listCategoriesAdmin(),
      // Si falla la lectura de filamentos el formulario sigue sirviendo.
      listFilamentsView().catch(() => []),
    ]);

    const materials = [
      ...new Set(filaments.map((f) => f.material.trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));

    return apiOk({
      categories: toAppCategoryRows(categories).map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        depth: c.depth,
        path: c.path,
      })),
      materials,
    });
  },
);
