import { notFound } from "next/navigation";
import { CouponForm } from "@/features/discounts/components/coupon-form";
import { getCoupon } from "@/features/discounts/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar cupón" };

function toLocalInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 16);
}

export default async function EditarCuponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coupon = await getCoupon(id);
  if (!coupon) notFound();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Marketing</div>
          <h1 className="page-title">Editar cupón</h1>
        </div>
      </div>
      <CouponForm
        id={coupon.id}
        defaults={{
          code: coupon.code,
          type: coupon.type,
          value: Number(coupon.value),
          minPurchase: Number(coupon.minPurchase),
          maxUses: coupon.maxUses != null ? String(coupon.maxUses) : "",
          startsAt: toLocalInput(coupon.startsAt),
          expiresAt: toLocalInput(coupon.expiresAt),
          isActive: coupon.isActive,
        }}
      />
    </div>
  );
}
