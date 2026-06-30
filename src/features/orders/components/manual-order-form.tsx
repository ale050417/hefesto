"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createManualSaleAction } from "../actions";

const PAYS = [
  { v: "cash", l: "Efectivo" },
  { v: "transfer", l: "Transferencia" },
  { v: "mercadopago", l: "MercadoPago" },
] as const;

const STATUSES = [
  { v: "delivered", l: "Entregado" },
  { v: "shipped", l: "Enviado" },
  { v: "ready", l: "Listo" },
  { v: "pending_payment", l: "Pendiente" },
  { v: "cancelled", l: "Cancelado" },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export function ManualSaleForm({
  onDone,
  onCancel,
}: {
  onDone?: () => void;
  onCancel?: () => void;
} = {}) {
  const router = useRouter();
  const [form, setForm] = useState({
    saleDate: today(),
    customerName: "",
    detail: "",
    total: "",
    paymentMethod: "cash" as (typeof PAYS)[number]["v"],
    status: "delivered" as (typeof STATUSES)[number]["v"],
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    const res = await createManualSaleAction(form);
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    if (onDone) {
      onDone();
      router.refresh();
    } else {
      router.push("/admin/pedidos");
    }
  }

  return (
    <div
      className={
        onDone
          ? "flex flex-col gap-4"
          : "ui-card flex max-w-2xl flex-col gap-4 p-6"
      }
    >
      <p className="text-faint text-[12.5px] leading-relaxed">
        Registrá una venta ya realizada (por ejemplo, ventas anteriores al
        sistema). Queda en el historial y suma a la facturación.
      </p>
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="ms-date">Fecha</label>
          <input
            id="ms-date"
            type="date"
            className="input"
            value={form.saleDate}
            onChange={(e) => set("saleDate", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ms-cust">Cliente</label>
          <input
            id="ms-cust"
            className="input"
            placeholder="Nombre del cliente"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="ms-det">Detalle / producto</label>
        <input
          id="ms-det"
          className="input"
          placeholder="Ej: 3 llaveros personalizados"
          value={form.detail}
          onChange={(e) => set("detail", e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="ms-total">Total cobrado (ARS)</label>
          <input
            id="ms-total"
            type="number"
            min={0}
            className="input"
            placeholder="0"
            value={form.total}
            onChange={(e) => set("total", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ms-pay">Método de pago</label>
          <select
            id="ms-pay"
            className="select"
            value={form.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value)}
          >
            {PAYS.map((p) => (
              <option key={p.v} value={p.v}>
                {p.l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="ms-status">Estado</label>
        <select
          id="ms-status"
          className="select"
          value={form.status}
          onChange={(e) => set("status", e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.v} value={s.v}>
              {s.l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onCancel ? onCancel() : router.push("/admin/pedidos")
          }
        >
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Registrando…" : "Registrar venta"}
        </Button>
      </div>
    </div>
  );
}
