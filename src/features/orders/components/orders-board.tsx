"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "../constants";
import type { OrderStatus, PaymentMethod } from "../types";
import { DeleteOrderButton } from "./order-actions";
import { DeleteManualSaleButton } from "./delete-manual-sale-button";
import { ManualSaleStatusSelect } from "./manual-sale-status-select";
import { OrderStatusSelect } from "./order-status-select";
import { ManualSaleEditButton } from "./manual-sale-edit-modal";

export type UnifiedSale = {
  id: string;
  source: "online" | "manual";
  date: string | Date;
  customerName: string | null;
  label: string;
  /** Referencia secundaria bajo el detalle (número de pedido en los online). */
  ref?: string | null;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  total: number;
  colors: string[];
  // Solo ventas manuales: para editar los números desde el tablero.
  detail?: string | null;
  category?: string | null;
  amortization?: number | null;
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });
const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
type Tipo = "todo" | "online" | "manual";

/**
 * Tabla UNIFICADA de ventas: pedidos online + ventas manuales en una sola
 * grilla, con filtros tocables por TIPO (Todo/Online/Manual) y por ESTADO
 * (aplican a AMBOS, porque las manuales también tienen estado). Filtrado del
 * lado del cliente sobre el set ya cargado (mismo patrón que el board de
 * Filamentos). El estado se edita INLINE tanto en manuales como en online (con
 * permiso); el online además tiene "Ver" para el detalle completo.
 */
export function OrdersBoard({
  items,
  isAdmin,
  canEdit,
}: {
  items: UnifiedSale[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const [tipo, setTipo] = useState<Tipo>("todo");
  const [status, setStatus] = useState<OrderStatus | "all">("all");

  const byTipo = useMemo(
    () => items.filter((o) => tipo === "todo" || o.source === tipo),
    [items, tipo],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of byTipo) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [byTipo]);
  const list = useMemo(
    () => byTipo.filter((o) => status === "all" || o.status === status),
    [byTipo, status],
  );

  const TipoBadge = ({ s }: { s: "online" | "manual" }) => (
    <Badge variant={s === "online" ? "info" : "neutral"}>
      {s === "online" ? "Online" : "Manual"}
    </Badge>
  );
  const StatusCell = ({ o }: { o: UnifiedSale }) =>
    !canEdit ? (
      <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
        {ORDER_STATUS_LABEL[o.status]}
      </Badge>
    ) : o.source === "manual" ? (
      <ManualSaleStatusSelect id={o.id} status={o.status} />
    ) : (
      <OrderStatusSelect id={o.id} status={o.status} />
    );
  const DeleteCell = ({ o }: { o: UnifiedSale }) =>
    !isAdmin ? null : o.source === "online" ? (
      <DeleteOrderButton orderId={o.id} orderNumber={o.label} />
    ) : (
      <DeleteManualSaleButton id={o.id} label={o.customerName ?? ""} />
    );
  // Datos de la venta manual para el modal de edición de números.
  const toEditData = (o: UnifiedSale) => ({
    id: o.id,
    customerName: o.customerName,
    detail: o.detail ?? null,
    category: o.category ?? null,
    saleDate: o.date,
    paymentMethod: o.paymentMethod,
    total: o.total,
    amortization: o.amortization ?? null,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["todo", "online", "manual"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cn("chip", tipo === t && "active")}
            onClick={() => setTipo(t)}
          >
            {t === "todo"
              ? "Todo"
              : t === "online"
                ? "Ventas online"
                : "Ventas manuales"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn("chip", status === "all" && "active")}
          onClick={() => setStatus("all")}
        >
          Todos <b className="opacity-60">{byTipo.length}</b>
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={cn("chip", status === s && "active")}
            onClick={() => setStatus(s)}
          >
            {ORDER_STATUS_LABEL[s]}{" "}
            <b className="opacity-60">{counts[s] ?? 0}</b>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          No hay ventas con estos filtros.
        </div>
      ) : (
        <>
          <div className="ui-card hidden overflow-hidden lg:block">
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Pedido / Detalle</th>
                    <th>Cliente</th>
                    <th>Color</th>
                    <th>Pago</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={`${o.source}-${o.id}`}>
                      <td>
                        <TipoBadge s={o.source} />
                      </td>
                      <td>
                        <b className="font-display text-fg tracking-wide">
                          {o.label || "—"}
                        </b>
                        <div className="text-faint text-[11.5px]">
                          {o.ref ? `${o.ref} · ` : ""}
                          {dateFmt.format(new Date(o.date))}
                        </div>
                      </td>
                      <td className="text-dim">{o.customerName ?? "—"}</td>
                      <td className="text-dim">
                        {o.colors.length ? o.colors.join(", ") : "—"}
                      </td>
                      <td className="text-dim">
                        {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                      </td>
                      <td>
                        <StatusCell o={o} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-fg">
                            {formatPrice(o.total)}
                          </span>
                          <DeleteCell o={o} />
                        </div>
                      </td>
                      <td className="text-right">
                        {o.source === "online" ? (
                          <Link
                            href={`/admin/pedidos/${o.id}`}
                            className="text-primary hover:underline"
                          >
                            Ver
                          </Link>
                        ) : canEdit ? (
                          <ManualSaleEditButton sale={toEditData(o)} />
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {list.map((o) => (
              <div key={`${o.source}-${o.id}`} className="ui-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1">
                      <TipoBadge s={o.source} />
                    </div>
                    <b className="font-display text-fg tracking-wide">
                      {o.label || "—"}
                    </b>
                    <div className="text-faint text-[11.5px]">
                      {o.ref ? `${o.ref} · ` : ""}
                      {dateFmt.format(new Date(o.date))}
                    </div>
                  </div>
                  <StatusCell o={o} />
                </div>
                <div className="text-dim mt-3 flex items-center justify-between text-sm">
                  <span>{o.customerName ?? "—"}</span>
                  <span>{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span>
                </div>
                {o.colors.length ? (
                  <div className="text-faint mt-1 text-[12px]">
                    Color: {o.colors.join(", ")}
                  </div>
                ) : null}
                <div className="border-surface-2 mt-3 flex items-center justify-between border-t pt-3">
                  <div className="text-fg text-lg font-medium">
                    {formatPrice(o.total)}
                  </div>
                  <div className="flex items-center gap-2">
                    <DeleteCell o={o} />
                    {o.source === "online" ? (
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Ver
                      </Link>
                    ) : canEdit ? (
                      <ManualSaleEditButton sale={toEditData(o)} />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
