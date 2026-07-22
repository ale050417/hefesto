"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { useFormErrors } from "@/hooks/use-form-errors";
import { updateManualSaleAction } from "../actions";
import { PAYMENT_METHOD_LABEL } from "../constants";
import type { PaymentMethod } from "../types";

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

function toDateInput(value: string | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export type ManualSaleEditData = {
  id: string;
  customerName: string | null;
  detail: string | null;
  category: string | null;
  saleDate: string | Date;
  paymentMethod: PaymentMethod;
  total: number;
  /** Costo actual (amortización = material + insumos). Null en ventas viejas. */
  amortization: number | null;
};

const PAYMENTS: PaymentMethod[] = ["transfer", "mercadopago", "cash"];

/** Botón "Editar" de una venta manual: abre el modal de edición de números. */
export function ManualSaleEditButton({ sale }: { sale: ManualSaleEditData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
      >
        Editar
      </button>
      {open ? (
        <ManualSaleEditModal
          sale={sale}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ManualSaleEditModal({
  sale,
  onClose,
  onSaved,
}: {
  sale: ManualSaleEditData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    customerName: sale.customerName ?? "",
    detail: sale.detail ?? "",
    category: sale.category ?? "",
    saleDate: toDateInput(sale.saleDate),
    // string (no PaymentMethod) para que el setter genérico no choque; el server
    // lo valida con zod (enum). El select solo ofrece los 3 métodos válidos.
    paymentMethod: String(sale.paymentMethod),
    total: String(sale.total),
    amortization: sale.amortization != null ? String(sale.amortization) : "",
  });
  const [busy, setBusy] = useState(false);
  const fe = useFormErrors();
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Ganancia en vivo = max(0, total − costo). Mismo criterio que el servidor.
  const totalN = Number(form.total) || 0;
  const costN = Math.max(0, Number(form.amortization) || 0);
  const ganancia = Math.max(0, totalN - costN);

  async function submit() {
    setBusy(true);
    const res = await runAction(
      () =>
        updateManualSaleAction(sale.id, {
          saleDate: form.saleDate,
          customerName: form.customerName,
          detail: form.detail,
          category: form.category,
          total: form.total,
          amortization: form.amortization === "" ? 0 : form.amortization,
          paymentMethod: form.paymentMethod,
        }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return fe.fromAction(res.error);
    toast("Venta actualizada", "success");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Editar venta manual">
      <div className="flex flex-col gap-4">
        <div className={`field ${fe.errors.customerName ? "invalid" : ""}`}>
          <label htmlFor="ms-name">Cliente</label>
          <input
            id="ms-name"
            className="input"
            aria-invalid={!!fe.errors.customerName}
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
          {fe.errors.customerName ? (
            <p className="field-error">{fe.errors.customerName}</p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="ms-detail">Detalle (qué se vendió)</label>
          <input
            id="ms-detail"
            className="input"
            placeholder="Ej: Chop copa del mundo"
            value={form.detail}
            onChange={(e) => set("detail", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="ms-cat">Categoría</label>
            <input
              id="ms-cat"
              className="input"
              placeholder="Opcional"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
          </div>
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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`field ${fe.errors.total ? "invalid" : ""}`}>
            <label htmlFor="ms-total">Total cobrado</label>
            <input
              id="ms-total"
              type="number"
              min={0}
              className="input"
              aria-invalid={!!fe.errors.total}
              value={form.total}
              onChange={(e) => set("total", e.target.value)}
            />
            {fe.errors.total ? (
              <p className="field-error">{fe.errors.total}</p>
            ) : null}
          </div>
          <div className={`field ${fe.errors.amortization ? "invalid" : ""}`}>
            <label htmlFor="ms-cost">Costo (material + insumos)</label>
            <input
              id="ms-cost"
              type="number"
              min={0}
              className="input"
              placeholder="0"
              aria-invalid={!!fe.errors.amortization}
              value={form.amortization}
              onChange={(e) => set("amortization", e.target.value)}
            />
            {fe.errors.amortization ? (
              <p className="field-error">{fe.errors.amortization}</p>
            ) : null}
          </div>
        </div>

        <div className="text-faint text-[11.5px] leading-relaxed">
          <b>Total</b> = lo que te pagó el cliente. <b>Costo</b> = todo lo que
          gastaste (material + insumos, ej. el vaso). La ganancia (total −
          costo) se recalcula sola. Un insumo que no cobrás va en el costo,
          nunca en el total.
        </div>

        <div className="field">
          <label htmlFor="ms-pay">Método de pago</label>
          <select
            id="ms-pay"
            className="select"
            value={form.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value)}
          >
            {PAYMENTS.map((p) => (
              <option key={p} value={p}>
                {PAYMENT_METHOD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>

        <div
          className="ui-card flex items-center justify-between"
          style={{ padding: "12px 14px" }}
        >
          <span className="text-[12.5px] font-semibold">
            Ganancia (total − costo)
          </span>
          <b
            className="price text-[16px]"
            style={{ color: "var(--gold-bright)" }}
          >
            {money(ganancia)}
          </b>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} loading={busy}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </Modal>
  );
}
