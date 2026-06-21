import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/core/auth/session";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { Badge } from "@/components/ui/badge";
import { getCustomerDetail } from "@/features/customers/admin/service";
import type { OrderStatus } from "@/features/orders/types";

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const data = await getCustomerDetail(id);
  if (!data) notFound();
  const { customer, orders } = data;

  return (
    <div className="grid gap-5">
      <Link href="/admin/clientes" className="text-dim hover:text-fg text-sm">
        ← Volver a clientes
      </Link>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cliente</div>
          <h1 className="page-title">{customer.fullName ?? "Sin nombre"}</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="ui-card p-4">
          <div className="text-dim text-xs">Pedidos</div>
          <div className="text-fg text-2xl font-semibold">
            {customer.orderCount}
          </div>
        </div>
        <div className="ui-card p-4">
          <div className="text-dim text-xs">Total gastado</div>
          <div className="text-fg text-2xl font-semibold">
            {formatPrice(customer.totalSpent)}
          </div>
        </div>
        <div className="ui-card p-4">
          <div className="text-dim text-xs">Teléfono</div>
          <div className="text-fg text-lg">{customer.phone ?? "—"}</div>
        </div>
      </div>

      <section className="ui-card table-wrap" style={{ border: "none" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Estado</th>
              <th className="text-right">Total</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-dim text-center">
                  Sin pedidos.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.orderNumber}>
                  <td>
                    <Link
                      href={`/admin/pedidos/${o.orderNumber}`}
                      className="text-[var(--gold-bright)] hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td>
                    <Badge
                      variant={ORDER_STATUS_VARIANT[o.status as OrderStatus]}
                    >
                      {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                    </Badge>
                  </td>
                  <td className="text-right">{formatPrice(o.total)}</td>
                  <td className="text-dim">
                    {new Date(o.createdAt).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
