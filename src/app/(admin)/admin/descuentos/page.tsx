import { requirePermissionPage } from "@/core/auth/permissions";
import { CouponsAdmin } from "@/features/discounts/components/coupons-admin";
import { listCoupons } from "@/features/discounts/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descuentos" };

export default async function DescuentosPage() {
  await requirePermissionPage("descuentos", "ver");
  const coupons = await listCoupons();
  return <CouponsAdmin coupons={coupons} />;
}
