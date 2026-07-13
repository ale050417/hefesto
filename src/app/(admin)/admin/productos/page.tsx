import { requirePermissionPage } from "@/core/auth/permissions";
import { ProductsAdmin } from "@/features/products/components/products-admin";
import { getEstimatorContext } from "@/features/calculator/service";
import { listColorCatalog } from "@/features/inventory/queries";
import { getBrandSettings } from "@/features/settings/service";
import { sectionOn } from "@/features/settings/home-sections";
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
  const [result, categories, estimator, colorCatalog, brand] =
    await loadOrThrow(
      "productos",
      Promise.all([
        listProductsAdmin({ page: 1, pageSize: 500 }),
        listCategories(),
        getEstimatorContext(),
        listColorCatalog(),
        getBrandSettings(),
      ]),
    );
  const sections = {
    nuevos: sectionOn(brand.homeSections, "nuevos"),
    destacados: true,
  };

  return (
    <ProductsAdmin
      products={result.items}
      categories={categories}
      estimator={estimator}
      colorCatalog={colorCatalog}
      sections={sections}
    />
  );
}
