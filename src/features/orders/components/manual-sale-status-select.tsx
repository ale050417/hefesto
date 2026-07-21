"use client";

import { useState } from "react";
import { toast } from "@/stores/toastStore";
import { ORDER_STATUS_LABEL } from "../constants";
import type { OrderStatus } from "../types";
import { updateManualSaleStatusAction } from "../actions";
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

// Color por estado (mismo criterio que los badges de pedidos online): tinte suave
// + texto/borde del color, para leer el estado de un vistazo.
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
 * Selector inline del estado de una venta manual (los mismos 8 estados que un
 * pedido). Optimista: cambia al instante y revierte si el servidor rechaza. Solo
 * se monta para staff con permiso de editar; la action re-valida en el servidor.
 */
export function ManualSaleStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);
  // Mientras se elige (con foco) el select va NEUTRO; al soltar muestra el color
  // del estado cargado (más fácil de leer sin distraer al cambiarlo).
  const [focused, setFocused] = useState(false);

  async function onChange(next: OrderStatus) {
    const prev = value;
    setValue(next);
    setBusy(true);
    const res = await runAction(() => updateManualSaleStatusAction(id, next), {
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
  const colored = !focused; // neutro con foco; color cuando muestra lo cargado
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
      aria-label="Estado de la venta"
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
