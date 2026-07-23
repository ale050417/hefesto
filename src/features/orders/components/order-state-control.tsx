"use client";

import { useState } from "react";
import { toast } from "@/stores/toastStore";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CANCEL_REASONS,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "../constants";
import { ORDER_TRANSITIONS } from "../transitions";
import type { OrderStatus } from "../types";

// Color por estado (mismo criterio que los badges): tinte suave + texto/borde.
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

const OTHER = "__other__";

/**
 * Control inline del estado (pedido online o venta manual). RESPETA la máquina de
 * estados: solo ofrece el estado actual + sus transiciones válidas. En estados
 * TERMINALES (cancelado / reembolsado) no hay selector: queda un badge fijo. Al
 * pasar a cancelado o reembolsado pide un MOTIVO (estándar o "Otro"), opcional.
 * `onTransition` recibe (destino, motivo) y hace el llamado al servidor.
 */
export function OrderStateControl({
  status,
  ariaLabel,
  onTransition,
}: {
  status: OrderStatus;
  ariaLabel: string;
  onTransition: (
    next: OrderStatus,
    reason: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [value, setValue] = useState<OrderStatus>(status);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  // Destino que espera motivo (cancelado/reembolsado) + elección del motivo.
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [reasonChoice, setReasonChoice] = useState<string>(CANCEL_REASONS[0]);
  const [reasonOther, setReasonOther] = useState("");

  const nexts = ORDER_TRANSITIONS[value];

  async function apply(next: OrderStatus, reason: string | null) {
    const prev = value;
    setValue(next);
    setBusy(true);
    const res = await onTransition(next, reason);
    setBusy(false);
    if (!res.ok) {
      setValue(prev);
      toast(res.error ?? "No se pudo actualizar el estado.", "danger");
      return;
    }
    toast("Estado actualizado", "success");
  }

  function onSelect(next: OrderStatus) {
    if (next === value) return;
    // Cancelar/reembolsar pide motivo (opcional) antes de aplicar.
    if (next === "cancelled" || next === "refunded") {
      setReasonChoice(CANCEL_REASONS[0]);
      setReasonOther("");
      setPending(next);
      return;
    }
    void apply(next, null);
  }

  function confirmReason() {
    const next = pending;
    if (!next) return;
    const reason =
      reasonChoice === OTHER ? reasonOther.trim() || null : reasonChoice;
    setPending(null);
    void apply(next, reason);
  }

  // Estado terminal: no se puede cambiar más → badge fijo (nada clickeable).
  if (nexts.length === 0) {
    return (
      <Badge variant={ORDER_STATUS_VARIANT[value]}>
        {ORDER_STATUS_LABEL[value]}
      </Badge>
    );
  }

  const options: OrderStatus[] = [value, ...nexts];
  const cvar = STATUS_VAR[value];
  const colored = !focused;

  return (
    <>
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
        aria-label={ariaLabel}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onSelect(e.target.value as OrderStatus)}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <Modal
        open={pending != null}
        onClose={() => setPending(null)}
        title={pending === "refunded" ? "Reembolsar" : "Cancelar"}
      >
        <div className="flex flex-col gap-3">
          <p className="text-faint text-[13px] leading-relaxed">
            Podés dejar el motivo (opcional). Queda guardado en el detalle del
            pedido.
          </p>
          <div className="field">
            <label>Motivo</label>
            <select
              className="select"
              value={reasonChoice}
              onChange={(e) => setReasonChoice(e.target.value)}
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value={OTHER}>Otro…</option>
            </select>
          </div>
          {reasonChoice === OTHER ? (
            <div className="field">
              <label>Escribí el motivo</label>
              <textarea
                className="input"
                rows={2}
                maxLength={300}
                value={reasonOther}
                onChange={(e) => setReasonOther(e.target.value)}
                placeholder="Ej: el cliente pidió otro color"
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPending(null)}
            >
              Volver
            </Button>
            <Button type="button" onClick={confirmReason} loading={busy}>
              {pending === "refunded" ? "Reembolsar" : "Cancelar pedido"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
