import { CouponForm } from "@/features/discounts/components/coupon-form";

export const metadata = { title: "Nuevo cupón" };

export default function NuevoCuponPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Marketing</div>
          <h1 className="page-title">Nuevo cupón</h1>
        </div>
      </div>
      <CouponForm />
    </div>
  );
}
