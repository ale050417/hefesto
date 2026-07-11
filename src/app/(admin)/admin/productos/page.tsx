import { requirePermissionPage } from "@/core/auth/permissions";
import { ProductsAdmin } from "@/features/products/components/products-admin";
import { getEstimatorContext } from "@/features/calculator/service";
import {
  listCategories,
  listProductsAdmin,
} from "@/features/products/services/catalogService";
import { loadOrThrow } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos" };

export default async function ProductosAdminPage() {
  await requirePermissionPage("productos", "ver");
  // Carga etiquetada y con deadline: error claro + log [admin:productos] en
  // vez de un cuelgue de 30 s si la DB no responde (2026-07-11).
  const [result, categories, estimator] = await loadOrThrow(
    "productos",
    Promise.all([
      listProductsAdmin({ page: 1, pageSize: 500 }),
      listCategories(),
      getEstimatorContext(),
    ]),
  );

  return (
    <ProductsAdmin
      products={result.items}
      categories={categories}
      estimator={estimator}
    />
  );
}
