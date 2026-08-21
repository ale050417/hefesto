"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDeleteResource } from "@/hooks/use-delete-resource";
import { deleteSalesAction } from "../actions";
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
  /** Desglose por combinación de colores (venta con varias combinaciones).
   *  Vacío/ausente = venta simple de siempre. */
  items?: Array<{
    variantLabel: string | null;
    color: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
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
  /** Ventas tildadas para borrar en lote. La clave lleva el TIPO adelante
   *  porque un pedido online y una venta manual pueden compartir id. */
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [confirmar, setConfirmar] = useState(false);

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

  // --- Selección múltiple (solo admin) ---------------------------------
  const keyOf = (o: UnifiedSale) => `${o.source}:${o.id}`;
  const visibles = list.map(keyOf);
  const enPantalla = visibles.filter((k) => elegidas.has(k));
  const todasElegidas =
    visibles.length > 0 && enPantalla.length === visibles.length;

  const alternar = (o: UnifiedSale) =>
    setElegidas((prev) => {
      const n = new Set(prev);
      const k = keyOf(o);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const alternarTodas = () =>
    setElegidas((prev) => {
      const n = new Set(prev);
      // Solo toca lo que se está viendo: si hay un filtro puesto, lo que quedó
      // fuera de pantalla no se selecciona ni se deselecciona por sorpresa.
      if (todasElegidas) for (const k of visibles) n.delete(k);
      else for (const k of visibles) n.add(k);
      return n;
    });

  const paraBorrar = useMemo(() => {
    const online: string[] = [];
    const manual: string[] = [];
    for (const k of elegidas) {
      const [source, id] = k.split(":");
      if (!id) continue;
      if (source === "online") online.push(id);
      else manual.push(id);
    }
    return { online, manual };
  }, [elegidas]);
  const cuantas = paraBorrar.online.length + paraBorrar.manual.length;

  const { deleteResource: borrarLote } = useDeleteResource({
    action: () => deleteSalesAction(paraBorrar),
    successMessage: `${cuantas} ${cuantas === 1 ? "venta eliminada" : "ventas eliminadas"}`,
    onDeleted: () => {
      setElegidas(new Set());
      setConfirmar(false);
    },
  });

  const Check = ({ o }: { o: UnifiedSale }) => {
    const on = elegidas.has(keyOf(o));
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={`${on ? "Quitar de" : "Agregar a"} la selección: ${o.label}`}
        onClick={() => alternar(o)}
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded border transition-colors",
          on ? "border-accent bg-accent text-accent-fg" : "border-surface-3",
        )}
      >
        {on ? (
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </button>
    );
  };

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
  /**
   * Desglose de una venta con VARIAS combinaciones de colores (2026-08-09):
   * qué combinación, cuántas y a qué precio. Colapsado por defecto para no
   * ensuciar la lista; la venta simple no muestra nada (no tiene líneas).
   */
  const Desglose = ({ o }: { o: UnifiedSale }) => {
    const items = o.items ?? [];
    if (items.length === 0) return null;
    const unidades = items.reduce((a, it) => a + it.quantity, 0);
    return (
      <details className="mt-1">
        <summary className="text-primary cursor-pointer text-[11.5px] hover:underline">
          {items.length} combinaciones · {unidades} unidades
        </summary>
        <div className="border-surface-2 mt-1 flex flex-col gap-0.5 border-l pl-2">
          {items.map((it, i) => (
            <div
              key={`${it.variantLabel ?? ""}-${it.color ?? ""}-${i}`}
              className="text-faint flex items-center justify-between gap-2 text-[11.5px]"
            >
              <span className="truncate">
                {it.quantity}× {it.variantLabel ?? it.color ?? "—"}
                {it.variantLabel && it.color ? ` · ${it.color}` : ""}
              </span>
              <span className="shrink-0">{formatPrice(it.lineTotal)}</span>
            </div>
          ))}
        </div>
      </details>
    );
  };
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

      {/* Barra de selección: aparece SOLO cuando hay algo tildado, así no
          ocupa lugar ni tienta a borrar de más en el uso normal. */}
      {isAdmin && cuantas > 0 ? (
        <div className="border-accent/40 bg-accent/5 flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-2.5">
          <b className="text-fg text-sm">
            {cuantas} {cuantas === 1 ? "venta elegida" : "ventas elegidas"}
          </b>
          <button
            type="button"
            className="text-dim hover:text-fg text-[12.5px] underline"
            onClick={() => setElegidas(new Set())}
          >
            Deseleccionar
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm ml-auto"
            onClick={() => setConfirmar(true)}
          >
            Eliminar seleccionadas
          </button>
        </div>
      ) : null}

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
                    {isAdmin ? (
                      <th style={{ width: 34 }}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={todasElegidas}
                          aria-label={
                            todasElegidas
                              ? "Deseleccionar todo lo que se ve"
                              : "Seleccionar todo lo que se ve"
                          }
                          onClick={alternarTodas}
                          className={cn(
                            "grid h-[18px] w-[18px] place-items-center rounded border transition-colors",
                            todasElegidas
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-surface-3",
                          )}
                        >
                          {todasElegidas ? (
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          ) : null}
                        </button>
                      </th>
                    ) : null}
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
                    <tr
                      key={`${o.source}-${o.id}`}
                      className={cn(elegidas.has(keyOf(o)) && "bg-accent/5")}
                    >
                      {isAdmin ? (
                        <td>
                          <Check o={o} />
                        </td>
                      ) : null}
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
                        <Desglose o={o} />
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
              <div
                key={`${o.source}-${o.id}`}
                className={cn(
                  "ui-card p-4",
                  elegidas.has(keyOf(o)) && "border-accent",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      {isAdmin ? <Check o={o} /> : null}
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
                <Desglose o={o} />
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

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={() => borrarLote("lote")}
        title={`¿Eliminar ${cuantas} ${cuantas === 1 ? "venta" : "ventas"}?`}
        detail={
          paraBorrar.online.length > 0 && paraBorrar.manual.length > 0
            ? `${paraBorrar.online.length} online y ${paraBorrar.manual.length} manuales. Se devuelve el filamento al stock y se revierten puntos y cupones.`
            : "Se devuelve el filamento al stock y se revierten los puntos y cupones que hayan generado."
        }
        confirmLabel="Eliminar todas"
      />
    </div>
  );
}
