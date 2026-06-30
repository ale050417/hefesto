import { requirePermissionPage } from "@/core/auth/permissions";
import { CategoriesAdmin } from "@/features/products/components/categories-admin";
import { listCategoriesAdmin } from "@/features/products/services/catalogService";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  await requirePermissionPage("productos", "ver");
  const categories = await listCategoriesAdmin();
  return <CategoriesAdmin categories={categories} />;
}
