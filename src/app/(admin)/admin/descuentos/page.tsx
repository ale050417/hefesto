import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { CouponsAdmin } from "@/features/discounts/components/coupons-admin";
import { listCoupons } from "@/features/discounts/queries";
import {
  listProductsForSale,
  listCategoriesAdmin,
} from "@/features/products/services/catalogService";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descuentos" };

export default async function DescuentosPage() {
  await requirePermissionPage("descuentos", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const couponsR = await safeLoad("descuentos", listCoupons(), []);
  const productsR = await safeLoad("productos", listProductsForSale(), []);
  const categoriesR = await safeLoad("categorías", listCategoriesAdmin(), []);
  const products = productsR.value.map((p) => ({ id: p.id, name: p.name }));
  const categories = categoriesR.value.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  return (
    <>
      <DegradedNotice sources={couponsR.ok ? [] : ["los cupones"]} />
      <CouponsAdmin
        coupons={couponsR.value}
        products={products}
        categories={categories}
      />
    </>
  );
}
