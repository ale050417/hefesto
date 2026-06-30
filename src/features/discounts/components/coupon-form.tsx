"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveCouponAction } from "../actions";

export type CouponFormData = {
  id?: string;
  code: string;
  description: string | null;
  type: "percentage" | "fixed";
  value: number;
  minPurchase: number;
  maxUses: number | null;
  startsAt: string | null;
  expiresAt: string | null; // ISO o "YYYY-MM-DD"
  isActive: boolean;
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function CouponForm({
  coupon,
  onDone,
  onCancel,
}: {
  coupon?: CouponFormData;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const edit = !!coupon?.id;
  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? ("percentage" as "percentage" | "fixed"),
    value: coupon ? String(coupon.value) : "",
    maxUses: coupon?.maxUses != null ? String(coupon.maxUses) : "",
    expiresAt: toDateInput(coupon?.expiresAt ?? null),
    isActive: coupon?.isActive ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    if (!form.code.trim()) return setErr("Ingresá un código");
    setBusy(true);
    const payload = {
      code: form.code,
      description: form.description,
      type: form.type,
      value: form.value,
      // Preservamos lo que este modal no edita.
      minPurchase: coupon?.minPurchase ?? 0,
      maxUses: form.maxUses,
      startsAt: coupon?.startsAt ?? "",
      expiresAt: form.expiresAt,
      isActive: form.isActive,
    };
    const res = await saveCouponAction(payload, coupon?.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    toast(edit ? "Cupón actualizado" : "Cupón creado", "success");
    onDone?.();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="field">
        <label htmlFor="cp-code">Código del cupón</label>
        <input
          id="cp-code"
          className="input"
          placeholder="HEFESTO15"
          style={{
            textTransform: "uppercase",
            fontFamily: "var(--font-display), sans-serif",
            letterSpacing: ".05em",
          }}
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="cp-desc">Descripción</label>
        <input
          id="cp-desc"
          className="input"
          placeholder="15% en toda la tienda"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="cp-type">Tipo</label>
          <select
            id="cp-type"
            className="select"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cp-value">Valor</label>
          <input
            id="cp-value"
            type="number"
            className="input"
            placeholder="15"
            value={form.value}
            onChange={(e) => set("value", e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="cp-limit">Límite total (vacío = ilimitado)</label>
          <input
            id="cp-limit"
            type="number"
            className="input"
            placeholder="0"
            value={form.maxUses}
            onChange={(e) => set("maxUses", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cp-exp">Fecha de expiración</label>
          <input
            id="cp-exp"
            type="date"
            className="input"
            value={form.expiresAt}
            onChange={(e) => set("expiresAt", e.target.value)}
          />
        </div>
      </div>

      <label className="text-dim flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--gold)]"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
        Cupón activo
      </label>

      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Crear cupón"}
        </Button>
      </div>
    </div>
  );
}
