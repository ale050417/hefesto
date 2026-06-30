import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "@/features/orders/constants";
import { getMyOrders } from "@/features/orders/services/orderQueries";
import type { MyOrderListItem } from "@/features/orders/services/orderQueries";
import { getBalance } from "@/features/rewards/service";
import { formatPrice, compactPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pedidos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

const P: Record<string, ReactNode> = {
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
  check: <path d="M20 6 9 17l-5-5" />,
  check2: <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.01l-3-3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  dollar: (
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  ),
  sparkles: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  ),
  printer: (
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </>
  ),
  send: <path d="m22 2-7 20-4-9-9-4 20-7z" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
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

type Status = MyOrderListItem["status"];

const ACTIVE: Status[] = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
];

// Pasos del seguimiento (paridad index): Pendiente → En producción → Listo → Enviado → Entregado.
const FLOW: { label: string; icon: string }[] = [
  { label: "Pendiente", icon: "clock" },
  { label: "En producción", icon: "printer" },
  { label: "Listo", icon: "package" },
  { label: "Enviado", icon: "truck" },
  { label: "Entregado", icon: "check2" },
];

const STEP_OF: Record<Status, number> = {
  pending_payment: 0,
  confirmed: 0,
  in_production: 1,
  ready: 2,
  shipped: 3,
  delivered: 4,
  cancelled: 0,
  refunded: 0,
};

const STEP_INFO: Record<Status, string> = {
  pending_payment: "Esperando el pago",
  confirmed: "Recibimos tu pedido",
  in_production: "Lo estamos imprimiendo",
  ready: "¡Listo para retirar!",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Pedido cancelado",
  refunded: "Pedido reembolsado",
};

const STATUS_ICON: Record<Status, string> = {
  pending_payment: "clock",
  confirmed: "clock",
  in_production: "printer",
  ready: "package",
  shipped: "truck",
  delivered: "check2",
  cancelled: "package",
  refunded: "package",
};

export default async function MyOrdersPage() {
  const user = await requireUser("/cuenta/pedidos");
  const [orders, points] = await Promise.all([
    getMyOrders(user.id),
    getBalance(user.id),
  ]);

  const firstName = (user.profile?.fullName || user.email || "Cliente").split(
    " ",
  )[0];
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) =>
    ["delivered", "cancelled", "refunded"].includes(o.status),
  );
  const ready = orders.filter((o) => o.status === "ready");
  const delivered = orders.filter((o) => o.status === "delivered");
  const spent = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "refunded")
    .reduce((a, o) => a + o.total, 0);

  return (
    <div>
      <div className="mo-head">
        <div>
          <div className="eyebrow">Hola, {firstName}</div>
          <h1 className="font-display text-3xl font-bold">Mis pedidos</h1>
          <div className="text-faint mt-1 text-sm">
            Seguí tus compras en tiempo real y revisá tu historial
          </div>
        </div>
        <Link href="/catalogo" className="btn btn-secondary">
          <Icon name="cart" size={17} /> Seguir comprando
        </Link>
      </div>

      <div className="mo-stats">
        <div className="mo-stat">
          <div className="mo-stat-ic">
            <Icon name="package" />
          </div>
          <div>
            <div className="mo-stat-n">{orders.length}</div>
            <div className="mo-stat-l">Pedidos totales</div>
          </div>
        </div>
        <div className="mo-stat">
          <div
            className="mo-stat-ic"
            style={{ background: "rgba(90,156,217,.14)", color: "var(--info)" }}
          >
            <Icon name="truck" />
          </div>
          <div>
            <div className="mo-stat-n">{active.length}</div>
            <div className="mo-stat-l">En curso</div>
          </div>
        </div>
        <div className="mo-stat">
          <div
            className="mo-stat-ic"
            style={{
              background: "rgba(76,183,130,.14)",
              color: "var(--success)",
            }}
          >
            <Icon name="check2" />
          </div>
          <div>
            <div className="mo-stat-n">{delivered.length}</div>
            <div className="mo-stat-l">Entregados</div>
          </div>
        </div>
        <div className="mo-stat">
          <div className="mo-stat-ic">
            <Icon name="dollar" />
          </div>
          <div>
            <div className="mo-stat-n">{compactPrice(spent)}</div>
            <div className="mo-stat-l">Total invertido</div>
          </div>
        </div>
        <Link href="/cuenta/puntos" className="mo-stat mo-stat-pts">
          <div
            className="mo-stat-ic"
            style={{ background: "rgba(var(--gold-rgb),.16)" }}
          >
            <Icon name="sparkles" />
          </div>
          <div>
            <div className="mo-stat-n" style={{ color: "var(--gold-bright)" }}>
              {points}
            </div>
            <div className="mo-stat-l">
              Puntos · canjear <Icon name="arrowRight" size={12} />
            </div>
          </div>
        </Link>
      </div>

      {ready.length > 0 ? (
        <div className="ready-banner">
          <div className="flex items-center gap-3">
            <div className="rb-ic">
              <Icon name="package" />
            </div>
            <div>
              <div className="text-[15px] font-bold">
                {ready.length === 1
                  ? "Tu pedido está listo para retirar 🎉"
                  : `${ready.length} pedidos listos para retirar 🎉`}
              </div>
              <div className="text-[13px] opacity-85">
                Pasá por el taller en el horario de atención.
              </div>
            </div>
          </div>
          <Link
            href={`/cuenta/pedidos/${encodeURIComponent(ready[0]!.orderNumber)}`}
            className="btn btn-sm"
            style={{
              background: "var(--gold-fg)",
              color: "var(--gold-bright)",
            }}
          >
            Ver detalle <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      ) : null}

      {active.length > 0 ? (
        <>
          <div className="eyebrow my-3.5">En curso</div>
          <div className="mb-9 flex flex-col gap-4">
            {active.map((o) => {
              const idx = STEP_OF[o.status];
              return (
                <div
                  key={o.orderNumber}
                  className={`ui-card order-card${o.status === "ready" ? "is-ready" : ""}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`oc-ic${o.status === "ready" ? "ready" : ""}`}
                      >
                        <Icon name={STATUS_ICON[o.status]} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <b>{o.orderNumber}</b>
                          <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                            {ORDER_STATUS_LABEL[o.status]}
                          </Badge>
                        </div>
                        <div className="text-faint mt-0.5 text-xs">
                          {STEP_INFO[o.status]} · {dateFmt.format(o.createdAt)}
                        </div>
                      </div>
                    </div>
                    <b className="text-[17px]">{formatPrice(o.total)}</b>
                  </div>

                  <div className="oc-steps">
                    {FLOW.map((f, i) => (
                      <div
                        key={f.label}
                        className={`oc-step ${i < idx ? "done" : i === idx ? "current" : ""}`}
                      >
                        <div className="ocs-dot">
                          <Icon name={i < idx ? "check" : f.icon} size={15} />
                        </div>
                        <div className="ocs-label">{f.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3.5">
                    <span className="text-faint text-[12.5px]">
                      {o.units} {o.units === 1 ? "producto" : "productos"} ·{" "}
                      {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                    </span>
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/cuenta/pedidos/${encodeURIComponent(o.orderNumber)}`}
                        className="btn btn-ghost btn-sm"
                      >
                        <Icon name="send" size={15} /> Chat
                      </Link>
                      <Link
                        href={`/cuenta/pedidos/${encodeURIComponent(o.orderNumber)}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Ver seguimiento
                      </Link>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="ui-card mb-9 flex flex-col items-center px-5 py-12 text-center">
          <span className="text-faint">
            <Icon name="package" size={36} />
          </span>
          <div className="text-fg mt-3 font-medium">
            No tenés pedidos en curso
          </div>
          <div className="text-faint mt-1 max-w-sm text-[13px]">
            Cuando hagas una compra vas a poder seguirla acá en tiempo real.
          </div>
          <Link href="/catalogo" className="btn btn-primary mt-5">
            <Icon name="cart" size={17} /> Ir al catálogo
          </Link>
        </div>
      )}

      {past.length > 0 ? (
        <>
          <div className="eyebrow my-3.5">
            Historial · {past.length} pedidos
          </div>
          <div className="ui-card p-0">
            <div className="table-wrap border-0">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Fecha</th>
                    <th>Productos</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {past.map((o) => (
                    <tr key={o.orderNumber}>
                      <td>
                        <b>{o.orderNumber}</b>
                      </td>
                      <td className="text-dim">
                        {dateFmt.format(o.createdAt)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className="ph flex-shrink-0 rounded-md"
                            style={{ width: 34, height: 34 }}
                          />
                          <div className="min-w-0">
                            <div className="text-fg truncate text-[13px] font-medium">
                              {o.title}
                              {o.moreCount > 0 ? (
                                <span className="text-faint font-normal">
                                  {" "}
                                  +{o.moreCount}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-faint text-[11px]">
                              {o.units} {o.units === 1 ? "unidad" : "unidades"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                      </td>
                      <td className="text-right font-medium">
                        {formatPrice(o.total)}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/cuenta/pedidos/${encodeURIComponent(o.orderNumber)}`}
                          className="text-[var(--gold-bright)] hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
