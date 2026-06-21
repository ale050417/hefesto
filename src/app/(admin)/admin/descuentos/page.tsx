import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CouponToggle } from "@/features/discounts/components/coupon-toggle";
import { listCoupons } from "@/features/discounts/queries";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descuentos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

export default async function DescuentosPage() {
  const coupons = await listCoupons();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Marketing</div>
          <h1 className="page-title">Descuentos</h1>
          <div className="page-sub">{coupons.length} cupones</div>
        </div>
        <Link
          href="/admin/descuentos/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Nuevo cupón
        </Link>
      </div>

      {coupons.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          Todavía no creaste cupones.
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descuento</th>
                  <th>Usos</th>
                  <th>Vence</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="font-display text-fg tracking-wide">
                      {c.code}
                    </td>
                    <td className="text-fg">
                      {c.type === "percentage"
                        ? `${Number(c.value)}%`
                        : formatPrice(Number(c.value))}
                    </td>
                    <td className="text-dim">
                      {c.usedCount}
                      {c.maxUses != null ? ` / ${c.maxUses}` : ""}
                    </td>
                    <td className="text-dim">
                      {c.expiresAt ? dateFmt.format(c.expiresAt) : "—"}
                    </td>
                    <td>
                      <CouponToggle id={c.id} isActive={c.isActive} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/descuentos/${c.id}/editar`}
                        className="text-primary hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
