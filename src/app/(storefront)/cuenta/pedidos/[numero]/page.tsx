import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { getOrderForCustomer } from "@/features/orders/services/orderQueries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle del pedido" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const user = await requireUser(`/cuenta/pedidos/${numero}`);
  const order = await getOrderForCustomer(decodeURIComponent(numero), user.id);
  if (!order) notFound();

  return (
    <div>
      <Link href="/cuenta/pedidos" className="text-dim hover:text-fg text-sm">
        ← Volver a mis pedidos
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <OrderSummary order={order} />
        {order.trackingCode || order.history.length > 0 ? (
          <aside className="space-y-4">
            {order.trackingCode ? (
              <div className="ui-card p-4">
                <h3 className="text-fg font-display mb-1 text-sm">
                  Seguimiento
                </h3>
                <p className="text-dim text-sm">{order.trackingCode}</p>
              </div>
            ) : null}
            <div className="ui-card p-4">
              <h3 className="text-fg font-display mb-3 text-sm">Seguimiento</h3>
              <div className="timeline">
                {order.history.map((h, i) => {
                  const isLast = i === order.history.length - 1;
                  return (
                    <div
                      key={h.id}
                      className={cn(
                        "tl-item",
                        isLast ? "tl-current" : "tl-done",
                      )}
                    >
                      <div className="tl-dot">{isLast ? "●" : "✓"}</div>
                      <div>
                        <div className="text-fg text-sm font-medium">
                          {ORDER_STATUS_LABEL[h.toStatus]}
                        </div>
                        <div className="text-faint text-xs">
                          {dateFmt.format(h.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
