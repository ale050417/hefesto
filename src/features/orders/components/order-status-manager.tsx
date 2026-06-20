"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { transitionOrderAction, updateOrderMetaAction } from "../actions";
import { ORDER_STATUS_LABEL } from "../constants";
import { ORDER_TRANSITIONS } from "../transitions";
import type { OrderStatus } from "../types";

export function OrderStatusManager({
  orderId,
  status,
  trackingCode,
  internalNote,
}: {
  orderId: string;
  status: OrderStatus;
  trackingCode: string | null;
  internalNote: string | null;
}) {
  const router = useRouter();
  const next = ORDER_TRANSITIONS[status];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(trackingCode ?? "");
  const [note, setNote] = useState(internalNote ?? "");

  async function go(to: OrderStatus) {
    setBusy(true);
    setError(null);
    const res = await transitionOrderAction(orderId, to);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  async function saveMeta() {
    setBusy(true);
    setError(null);
    const res = await updateOrderMetaAction(orderId, {
      trackingCode: tracking.trim() || null,
      internalNote: note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="ui-card space-y-4 p-4">
      <h3 className="text-fg font-display text-sm">Gestión</h3>

      {error ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {next.length > 0 ? (
        <div>
          <p className="text-dim mb-2 text-xs">Cambiar estado a:</p>
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={
                  s === "cancelled" || s === "refunded" ? "danger" : "primary"
                }
                disabled={busy}
                onClick={() => go(s)}
              >
                {ORDER_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-dim text-sm">Este pedido está en un estado final.</p>
      )}

      <div className="space-y-2 border-t border-[var(--border)] pt-3">
        <label className="text-dim block text-xs">Código de seguimiento</label>
        <input
          className="input"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Ej. AR123456789"
        />
        <label className="text-dim block text-xs">Nota interna</label>
        <textarea
          className="textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Visible solo para el equipo"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={saveMeta}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
