"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);

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
    router.refresh();
  }

  return (
    <select
      className="select"
      style={{ width: "auto", minWidth: 150 }}
      value={value}
      disabled={busy}
      aria-label="Estado de la venta"
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
