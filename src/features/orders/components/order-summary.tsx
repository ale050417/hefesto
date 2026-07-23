import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "../constants";
import type { ShippingAddress } from "../schemas";
import type { OrderWithItems } from "../types";

// Componente presentacional (server): muestra el pedido ya leído de la base.
// `action` es un slot opcional que se renderiza al lado del Total (ej. el botón
// de eliminar pedido, solo para admin).
export function OrderSummary({
  order,
  action,
}: {
  order: OrderWithItems;
  action?: ReactNode;
}) {
  const shipping = order.shippingAddress as ShippingAddress | null;

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-dim text-xs">Pedido</p>
          <p className="font-display text-fg text-xl tracking-wide">
            {order.orderNumber}
          </p>
        </div>
        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
          {ORDER_STATUS_LABEL[order.status]}
        </Badge>
      </header>

      {(order.status === "cancelled" || order.status === "refunded") &&
      order.cancelReason ? (
        <div className="bg-surface-1 border-surface-2 rounded-lg border p-3 text-sm">
          <span className="text-dim">
            Motivo de{" "}
            {order.status === "refunded" ? "reembolso" : "cancelación"}:{" "}
          </span>
          <span className="text-fg">{order.cancelReason}</span>
        </div>
      ) : null}

      <section className="bg-surface-1 border-surface-2 rounded-lg border">
        <ul className="divide-surface-2 divide-y">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-3 p-3 text-sm">
              <span className="text-fg">
                {it.quantity}× {it.productName}
                {it.variantLabel ? (
                  <span className="text-dim"> ({it.variantLabel})</span>
                ) : null}
              </span>
              <span className="text-fg">
                {formatPrice(Number(it.lineTotal))}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-surface-2 space-y-1 border-t p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-dim">Subtotal</span>
            <span className="text-fg">
              {formatPrice(Number(order.subtotal))}
            </span>
          </div>
          {Number(order.discountAmount) > 0 ? (
            <div className="flex justify-between">
              <span className="text-dim">Descuento</span>
              <span className="text-fg">
                -{formatPrice(Number(order.discountAmount))}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-base font-medium">
            <span className="text-fg">Total</span>
            <span className="flex items-center gap-2">
              <span className="text-fg">
                {formatPrice(Number(order.total))}
              </span>
              {action}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="bg-surface-1 border-surface-2 rounded-lg border p-3">
          <h3 className="text-fg mb-1 text-sm font-medium">Pago</h3>
          <p className="text-dim text-sm">
            {PAYMENT_METHOD_LABEL[order.paymentMethod]}
          </p>
        </div>
        {shipping ? (
          <div className="bg-surface-1 border-surface-2 rounded-lg border p-3">
            <h3 className="text-fg mb-1 text-sm font-medium">Envío</h3>
            <p className="text-dim text-sm">
              {shipping.fullName} · {shipping.phone}
              <br />
              {shipping.street}, {shipping.city}, {shipping.province} (
              {shipping.postalCode})
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
