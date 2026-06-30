"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EstimatorModalButton } from "@/features/calculator/components/estimator-modal-button";
import type { EstimatorValue } from "@/features/calculator/components/price-estimator";
import type { EstimatorContext } from "@/features/calculator/service";
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

type SplitPart = { name: string; pct: string };

export function ManualSaleForm({
  partners = [],
  estimator,
  onDone,
  onCancel,
}: {
  partners?: Array<{ name: string; pct: number }>;
  estimator: EstimatorContext;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    saleDate: today(),
    customerName: "",
    detail: "",
    total: "",
    paymentMethod: "cash" as (typeof PAYS)[number]["v"],
    status: "delivered" as (typeof STATUSES)[number]["v"],
  });
  // Calculadora flotante opcional: al "Usar precio" copia el total.
  function handleEstUse(v: EstimatorValue) {
    if (v.price != null) setForm((f) => ({ ...f, total: String(v.price) }));
  }
  // Reparto de la ganancia de ESTA venta. "current" = dividir por los socios
  // actuales (no se manda nada; lo resuelve Ganancias). "custom" = guardar este
  // reparto fijo (útil para ventas viejas: cuando trabajabas solo o eran menos).
  const [splitMode, setSplitMode] = useState<"current" | "custom">("current");
  const [parts, setParts] = useState<SplitPart[]>(() =>
    partners.length > 0
      ? partners.map((p) => ({ name: p.name, pct: String(p.pct) }))
      : [{ name: "", pct: "100" }],
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setPart = (i: number, k: keyof SplitPart, v: string) =>
    setParts((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const addPart = () => setParts((ps) => [...ps, { name: "", pct: "0" }]);
  const removePart = (i: number) =>
    setParts((ps) => ps.filter((_, j) => j !== i));
  const allForMe = () =>
    setParts([{ name: partners[0]?.name ?? "Yo", pct: "100" }]);

  const splitTotal = parts.reduce((a, p) => a + (Number(p.pct) || 0), 0);

  async function submit() {
    setErr(null);
    if (splitMode === "custom") {
      const valid = parts.filter((p) => p.name.trim() && Number(p.pct) > 0);
      if (valid.length === 0)
        return setErr("Cargá al menos una persona con su porcentaje.");
      if (Math.round(splitTotal) !== 100)
        return setErr(
          `Los porcentajes deben sumar 100% (suman ${splitTotal}%).`,
        );
    }
    setBusy(true);
    const profitSplit =
      splitMode === "custom"
        ? parts
            .filter((p) => p.name.trim() && Number(p.pct) > 0)
            .map((p) => ({ name: p.name.trim(), pct: Number(p.pct) }))
        : undefined;
    const res = await createManualSaleAction({ ...form, profitSplit });
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
          <div className="mt-1">
            <EstimatorModalButton estimator={estimator} onUse={handleEstUse} />
          </div>
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

      <div className="field">
        <label>Reparto de la ganancia</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`chip ${splitMode === "current" ? "active" : ""}`}
            onClick={() => setSplitMode("current")}
          >
            Dividir por socios actuales
          </button>
          <button
            type="button"
            className={`chip ${splitMode === "custom" ? "active" : ""}`}
            onClick={() => setSplitMode("custom")}
          >
            Personalizar
          </button>
        </div>
        {splitMode === "current" ? (
          <p className="text-faint mt-1.5 text-[12px] leading-relaxed">
            {partners.length > 0
              ? `Se reparte entre los ${partners.length} socio(s) actuales según sus porcentajes, igual que las compras de la tienda.`
              : "No hay socios cargados: la ganancia queda sin repartir hasta que agregues socios en Ganancias."}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-faint text-[12px] leading-relaxed">
              Reparto fijo para esta venta (no cambia si después sumás o sacás
              socios). Útil para ventas viejas.
            </p>
            {parts.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Nombre"
                  value={p.name}
                  onChange={(e) => setPart(i, "name", e.target.value)}
                />
                <input
                  className="input"
                  style={{ width: 90 }}
                  type="number"
                  min={0}
                  max={100}
                  placeholder="%"
                  value={p.pct}
                  onChange={(e) => setPart(i, "pct", e.target.value)}
                />
                <span className="text-faint text-[12px]">%</span>
                {parts.length > 1 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => removePart(i)}
                    aria-label="Quitar"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addPart}
              >
                + Agregar persona
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={allForMe}
              >
                Todo para mí
              </button>
              <span
                className="ml-auto text-[12px]"
                style={{
                  color:
                    Math.round(splitTotal) === 100
                      ? "var(--success)"
                      : "var(--warning)",
                }}
              >
                Suma: {splitTotal}%
              </span>
            </div>
          </div>
        )}
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
