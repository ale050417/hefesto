import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import { OrderStatusManager } from "@/features/orders/components/order-status-manager";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { getOrderAdmin } from "@/features/orders/services/orderAdminService";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle de pedido" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function OrderDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderAdmin(id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/admin/pedidos" className="text-dim hover:text-fg text-sm">
        ← Volver a pedidos
      </Link>
      <div className="page-head mt-2">
        <div>
          <div className="eyebrow">Pedido</div>
          <h1 className="page-title">{order.orderNumber}</h1>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <OrderSummary order={order} />

        <aside className="space-y-4">
          <OrderStatusManager
            orderId={order.id}
            status={order.status}
            trackingCode={order.trackingCode}
            internalNote={order.internalNote}
          />

          <div className="ui-card p-4">
            <h3 className="text-fg font-display mb-2 text-sm">Cliente</h3>
            <p className="text-dim text-sm">
              {order.customer?.fullName ?? "—"}
              {order.customer?.phone ? (
                <>
                  <br />
                  {order.customer.phone}
                </>
              ) : null}
            </p>
          </div>

          <div className="ui-card p-4">
            <h3 className="text-fg font-display mb-3 text-sm">Historial</h3>
            <div className="timeline">
              {order.history.map((h, i) => {
                const isLast = i === order.history.length - 1;
                return (
                  <div
                    key={h.id}
                    className={cn("tl-item", isLast ? "tl-current" : "tl-done")}
                  >
                    <div className="tl-dot">{isLast ? "●" : "✓"}</div>
                    <div>
                      <div className="text-fg text-sm font-medium">
                        {ORDER_STATUS_LABEL[h.toStatus]}
                      </div>
                      <div className="text-faint text-xs">
                        {dateFmt.format(h.createdAt)}
                      </div>
                      {h.note ? (
                        <div className="text-dim mt-0.5 text-xs">{h.note}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
