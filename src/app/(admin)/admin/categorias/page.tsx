import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { CategoriesAdmin } from "@/features/products/components/categories-admin";
import { listCategoriesAdmin } from "@/features/products/services/catalogService";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorías" };

export default async function CategoriasPage() {
  await requirePermissionPage("productos", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const categoriesR = await safeLoad("categorías", listCategoriesAdmin(), []);
  return (
    <>
      <DegradedNotice sources={categoriesR.ok ? [] : ["las categorías"]} />
      <CategoriesAdmin categories={categoriesR.value} />
    </>
  );
}
