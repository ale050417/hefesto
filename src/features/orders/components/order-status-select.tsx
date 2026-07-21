"use client";

import { useState } from "react";
import { toast } from "@/stores/toastStore";
import { ORDER_STATUS_LABEL } from "../constants";
import type { OrderStatus } from "../types";
import { transitionOrderAction } from "../actions";
import { runAction } from "@/lib/run-action";

// Mismo orden que la máquina de estados de pedidos (Cap. 11).
const STATUS_ORDER: OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

// Color por estado (igual criterio que los badges): tinte suave + texto/borde del
// color cuando muestra lo cargado; neutro mientras se está eligiendo (con foco).
const STATUS_VAR: Record<OrderStatus, string> = {
  pending_payment: "--warning",
  confirmed: "--info",
  in_production: "--info",
  ready: "--info",
  shipped: "--info",
  delivered: "--success",
  cancelled: "--danger",
  refunded: "--text-dim",
};

/**
 * Selector inline del estado de un pedido ONLINE, directo desde la tabla (sin
 * entrar a "Ver"). Optimista: cambia al instante y revierte si el servidor lo
 * rechaza — la action valida la máquina de estados y el permiso (cancelar /
 * reembolsar es solo admin). El "Ver" sigue disponible para el detalle completo.
 */
export function OrderStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  async function onChange(next: OrderStatus) {
    const prev = value;
    setValue(next);
    setBusy(true);
    const res = await runAction(() => transitionOrderAction(id, next), {
      silent: true,
    });
    setBusy(false);
    if (!res.ok) {
      setValue(prev);
      toast(res.error.message, "danger");
      return;
    }
    toast("Estado actualizado", "success");
  }

  const cvar = STATUS_VAR[value];
  const colored = !focused;
  return (
    <select
      className="select"
      style={{
        width: "auto",
        minWidth: 150,
        fontWeight: 600,
        transition: "background .15s, color .15s, border-color .15s",
        color: colored ? `var(${cvar})` : "var(--text)",
        borderColor: colored
          ? `color-mix(in srgb, var(${cvar}) 45%, var(--border))`
          : "var(--border)",
        background: colored
          ? `color-mix(in srgb, var(${cvar}) 12%, var(--surface-1))`
          : "var(--surface-1)",
      }}
      value={value}
      disabled={busy}
      aria-label="Estado del pedido"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value as OrderStatus)}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
