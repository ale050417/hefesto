import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { CouponsAdmin } from "@/features/discounts/components/coupons-admin";
import { listCoupons } from "@/features/discounts/queries";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descuentos" };

export default async function DescuentosPage() {
  await requirePermissionPage("descuentos", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const couponsR = await safeLoad("descuentos", listCoupons(), []);
  return (
    <>
      <DegradedNotice sources={couponsR.ok ? [] : ["los cupones"]} />
      <CouponsAdmin coupons={couponsR.value} />
    </>
  );
}
