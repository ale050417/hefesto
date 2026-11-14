import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { subtreeIds } from "@/features/products/category-tree";
import {
  buildProductCreateCandidate,
  escapeLike,
  fieldErrors,
  parseProductListQuery,
  toAppProductRow,
  validationMessage,
} from "@/features/products/admin-api";
import { respondBusinessError } from "@/features/products/admin-api-http";
import { createProductFlow, withCosts } from "@/features/products/admin-flow";
import { revalidateProductCaches } from "@/features/products/admin-revalidate";
import { productInputSchema } from "@/features/products/schemas";
import {
  countProductsAdmin,
  getCategoryAdmin,
  listCategoriesAdmin,
  listProductsAdminFull,
} from "@/features/products/services/catalogService";

/**
 * Productos del panel de la app (2026-10-31).
 *  - GET  → listado paginado con búsqueda y filtros. Permiso productos/ver.
 *           Query: q, status (all|published|draft|archived), category (id,
 *           incluye subcategorías), featured, onSale, noImages, sort
 *           (updated|newest|name|price_asc|price_desc), page, pageSize (máx 200).
 *  - POST → alta básica. Permiso productos/crear. Nace como BORRADOR (publicar
 *           exige fotos, que se suben desde la web) y con la MISMA validación y
 *           cálculo de costos que el alta web (`createProductAction`).
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/productos", async (request: Request) => {
  const auth = await requireApiPerm(request, "productos", "ver");
  if ("response" in auth) return auth.response;

  const parsed = parseProductListQuery(new URL(request.url).searchParams);
  if (!parsed.success) return apiError("invalid", "Filtros inválidos.");
  const q = parsed.data;

  // Filtrar por una categoría incluye toda su descendencia (como la web).
  let categoryIds: string[] | undefined;
  if (q.category) {
    const all = await listCategoriesAdmin();
    if (!all.some((c) => c.id === q.category)) {
      return apiError("not_found", "Esa categoría ya no existe.");
    }
    categoryIds = subtreeIds(all, q.category);
  }

  const [result, counts] = await Promise.all([
    listProductsAdminFull({
      search: q.q ? escapeLike(q.q) : undefined,
      status: q.status === "all" ? undefined : q.status,
      categoryIds,
      featured: q.featured,
      onSale: q.onSale,
      noImages: q.noImages,
      sort: q.sort,
      page: q.page,
      pageSize: q.pageSize,
    }),
    countProductsAdmin(),
  ]);

  return apiOk({
    items: result.items.map(toAppProductRow),
    total: result.total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(result.total / q.pageSize)),
    counts,
  });
});

export const POST = withApi("admin/productos", async (request: Request) => {
  const auth = await requireApiPerm(request, "productos", "crear");
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const candidate = buildProductCreateCandidate(body);
  if (!candidate) return apiError("invalid", "Datos inválidos.");

  const parsed = productInputSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return apiError("invalid", validationMessage(fields), { fields });
  }

  // La categoría tiene que existir (si no, la base rechaza con un error opaco).
  if (!(await getCategoryAdmin(parsed.data.categoryId))) {
    return apiError("invalid", "La categoría elegida ya no existe.", {
      fields: { categoryId: "Elegí una categoría" },
    });
  }

  // Amortización y ganancia: obligatorias, las calcula el servidor.
  const data = await withCosts(parsed.data);
  if (!data) {
    return apiError(
      "invalid",
      "No pudimos calcular el costo de producción. Elegí un material que tenga filamento cargado e indicá los gramos y el tiempo de impresión.",
      { fields: { price: "Falta calcular la amortización" } },
    );
  }

  try {
    const product = await createProductFlow(auth.user.id, data);
    revalidateProductCaches(product.slug);
    return apiOk({ id: product.id, slug: product.slug }, { status: 201 });
  } catch (error) {
    return respondBusinessError(error, "Ya existe un producto con ese slug.");
  }
});
