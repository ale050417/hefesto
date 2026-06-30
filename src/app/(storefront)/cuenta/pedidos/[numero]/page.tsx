import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { getOrderForCustomer } from "@/features/orders/services/orderQueries";
import { getOrderMessages } from "@/features/orders/services/orderChat";
import { OrderChat } from "@/features/orders/components/order-chat";
import type { OrderStatus } from "@/features/orders/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle del pedido" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const P: Record<string, ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  printer: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  package: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  truck: (
    <>
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
};

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}

const FLOW: { status: OrderStatus; icon: string }[] = [
  { status: "confirmed", icon: "check" },
  { status: "in_production", icon: "printer" },
  { status: "ready", icon: "package" },
  { status: "shipped", icon: "truck" },
  { status: "delivered", icon: "home" },
];

export default async function MyOrderDetailPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const user = await requireUser(`/cuenta/pedidos/${numero}`);
  const order = await getOrderForCustomer(decodeURIComponent(numero), user.id);
  if (!order) notFound();
  const messages = await getOrderMessages(order.id);

  const isCancelled =
    order.status === "cancelled" || order.status === "refunded";
  const curIdx = FLOW.findIndex((f) => f.status === order.status);
  const stamp = new Map(order.history.map((h) => [h.toStatus, h.createdAt]));

  return (
    <div>
      <Link href="/cuenta/pedidos" className="text-dim hover:text-fg text-sm">
        ← Volver a mis pedidos
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Tu pedido</div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">
              {order.orderNumber}
            </h1>
            <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
          </div>
        </div>
      </div>

      {order.status === "ready" ? (
        <div className="ready-banner mb-6">
          <div className="flex items-center gap-3">
            <div className="rb-ic">
              <Icon name="package" size={22} />
            </div>
            <div>
              <div className="text-sm font-bold">¡Listo para retirar! 🎉</div>
              <div className="text-[12.5px] opacity-85">
                Pasá por el taller en el horario de atención.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <OrderSummary order={order} />
          <section className="ui-card p-5">
            <h3 className="text-fg font-display mb-3 text-sm">
              Mensajes con el taller
            </h3>
            <OrderChat
              orderId={order.id}
              messages={messages}
              viewerIsStaff={false}
            />
          </section>
        </div>

        <aside className="space-y-4">
          {order.trackingCode ? (
            <div className="ui-card p-4">
              <div className="text-faint mb-1 text-[11px] tracking-wider uppercase">
                Código de seguimiento
              </div>
              <b className="text-[var(--gold-bright)]">{order.trackingCode}</b>
            </div>
          ) : null}

          <div className="ui-card p-4">
            <div className="text-faint mb-3.5 text-[11px] tracking-wider uppercase">
              Estado del pedido
            </div>
            <div className="timeline">
              {isCancelled
                ? order.history.map((h, i) => (
                    <div
                      key={h.id}
                      className={`tl-item ${i === order.history.length - 1 ? "tl-current" : "tl-done"}`}
                    >
                      <div className="tl-dot">
                        <Icon name="check" />
                      </div>
                      <div>
                        <div className="text-fg text-sm font-medium">
                          {ORDER_STATUS_LABEL[h.toStatus]}
                        </div>
                        <div className="text-faint text-xs">
                          {dateFmt.format(h.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                : FLOW.map((f, i) => {
                    const state =
                      i < curIdx
                        ? "done"
                        : i === curIdx
                          ? "current"
                          : "pending";
                    const ts = stamp.get(f.status);
                    return (
                      <div key={f.status} className={`tl-item tl-${state}`}>
                        <div className="tl-dot">
                          <Icon name={state === "done" ? "check" : f.icon} />
                        </div>
                        <div>
                          <div className="text-fg text-sm font-medium">
                            {ORDER_STATUS_LABEL[f.status]}
                          </div>
                          <div className="text-faint text-xs">
                            {ts ? dateFmt.format(ts) : "Pendiente"}
                          </div>
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
