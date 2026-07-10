"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "../constants";
import type { OrderListItem } from "../types";
import { deleteOrdersAction } from "../actions";
import { DeleteOrderButton } from "./order-actions";
import { useDeleteResource } from "@/hooks/use-delete-resource";

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

/**
 * Lista de pedidos del panel: tabla en escritorio y tarjetas en móvil (sin
 * scroll horizontal). Para admin agrega selección múltiple + eliminar en lote
 * y el botón de eliminar al lado del Total en cada fila/tarjeta.
 */
export function OrdersAdminList({
  items,
  isAdmin,
}: {
  items: OrderListItem[];
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const ids = useMemo(() => items.map((o) => o.id), [items]);
  const allSelected = selected.size > 0 && selected.size === ids.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === ids.length ? new Set() : new Set(ids),
    );
  }
  function deselect(id: string) {
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Patrón único de eliminación, en LOTE: una sola action con todos los ids.
  const { deleteResource: removeOrders } = useDeleteResource<string[]>({
    action: (ids) => deleteOrdersAction(ids),
    successMessage: (ids) =>
      `${ids.length} pedido${ids.length === 1 ? "" : "s"} eliminado${
        ids.length === 1 ? "" : "s"
      }`,
    onDeleted: () => setSelected(new Set()),
  });

  async function confirmBulkDelete() {
    await removeOrders([...selected]);
  }

  return (
    <div className="space-y-3">
      {isAdmin && selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="text-dim text-sm">
            {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(new Set())}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setBulkOpen(true)}
            >
              Eliminar seleccionados
            </button>
          </div>
        </div>
      ) : null}

      {/* Escritorio: tabla */}
      <div className="ui-card hidden overflow-hidden md:block">
        <div className="table-wrap" style={{ border: "none" }}>
          <table className="tbl">
            <thead>
              <tr>
                {isAdmin ? (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      className="ck"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                ) : null}
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Pago</th>
                <th>Estado</th>
                <th className="text-right">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className={selected.has(o.id) ? "row-sel" : ""}>
                  {isAdmin ? (
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${o.orderNumber}`}
                        className="ck"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                    </td>
                  ) : null}
                  <td>
                    <b className="font-display text-fg tracking-wide">
                      {o.orderNumber}
                    </b>
                    <div className="text-faint text-[11.5px]">
                      {dateFmt.format(o.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span
                        className="avatar"
                        style={{ width: 30, height: 30, fontSize: 11 }}
                      >
                        {(o.customerName?.[0] ?? "?").toUpperCase()}
                      </span>
                      <span className="text-dim">{o.customerName ?? "—"}</span>
                    </div>
                  </td>
                  <td className="text-dim">
                    {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                  </td>
                  <td>
                    <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-fg">{formatPrice(o.total)}</span>
                      {isAdmin ? (
                        <DeleteOrderButton
                          orderId={o.id}
                          orderNumber={o.orderNumber}
                          onDeleted={() => deselect(o.id)}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="text-primary hover:underline"
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

      {/* Móvil: tarjetas apiladas */}
      <div className="flex flex-col gap-3 md:hidden">
        {items.map((o) => (
          <div
            key={o.id}
            className={cn("ui-card p-4", selected.has(o.id) && "row-sel")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${o.orderNumber}`}
                    className="ck"
                    checked={selected.has(o.id)}
                    onChange={() => toggle(o.id)}
                  />
                ) : null}
                <div>
                  <b className="font-display text-fg tracking-wide">
                    {o.orderNumber}
                  </b>
                  <div className="text-faint text-[11.5px]">
                    {dateFmt.format(o.createdAt)}
                  </div>
                </div>
              </div>
              <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                {ORDER_STATUS_LABEL[o.status]}
              </Badge>
            </div>

            <div className="text-dim mt-3 flex items-center justify-between text-sm">
              <span>{o.customerName ?? "—"}</span>
              <span>{PAYMENT_METHOD_LABEL[o.paymentMethod]}</span>
            </div>

            <div className="border-surface-2 mt-3 flex items-center justify-between border-t pt-3">
              <div>
                <div className="text-faint text-[11px]">Total</div>
                <div className="text-fg text-lg font-medium">
                  {formatPrice(o.total)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <DeleteOrderButton
                    orderId={o.id}
                    orderNumber={o.orderNumber}
                    onDeleted={() => deselect(o.id)}
                  />
                ) : null}
                <Link
                  href={`/admin/pedidos/${o.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Ver
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`¿Eliminar ${selected.size} pedido${
          selected.size === 1 ? "" : "s"
        }?`}
        description="Se eliminarán de forma permanente los pedidos seleccionados."
        detail="Se revierten los puntos y usos de cupón que hayan generado. Esta acción no se puede deshacer."
        confirmLabel={`Eliminar ${selected.size}`}
        onConfirm={confirmBulkDelete}
      />
    </div>
  );
}
