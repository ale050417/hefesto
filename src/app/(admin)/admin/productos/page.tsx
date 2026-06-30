import { requirePermissionPage } from "@/core/auth/permissions";
import { ProductsAdmin } from "@/features/products/components/products-admin";
import {
  listCategories,
  listProductsAdmin,
} from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";
export const metadata = { title: "Productos" };

export default async function ProductosAdminPage() {
  await requirePermissionPage("productos", "ver");
  const [result, categories] = await Promise.all([
    listProductsAdmin({ page: 1, pageSize: 500 }),
    listCategories(),
  ]);

  return <ProductsAdmin products={result.items} categories={categories} />;
}
