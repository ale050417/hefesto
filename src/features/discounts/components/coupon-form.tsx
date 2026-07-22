"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveCouponAction } from "../actions";
import { runAction } from "@/lib/run-action";
import { useFormErrors } from "@/hooks/use-form-errors";

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
  scope: "all" | "product" | "category";
  targetId: string | null;
  targetLabel: string | null;
  birthdayOnly: boolean;
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const STEPS = ["Descuento", "Aplica a", "Límites"];

function CouponPreview({
  code,
  type,
  value,
  scope,
  targetLabel,
  birthdayOnly,
  expiresAt,
  minPurchase,
  isActive,
}: {
  code: string;
  type: "percentage" | "fixed";
  value: string;
  scope: "all" | "product" | "category";
  targetLabel: string;
  birthdayOnly: boolean;
  expiresAt: string;
  minPurchase: number;
  isActive: boolean;
}) {
  const v = Number(value) || 0;
  const big =
    type === "percentage"
      ? `${v || "—"}%`
      : `$${v ? v.toLocaleString("es-AR") : "—"}`;
  const scopeText =
    scope === "all"
      ? "Toda la compra"
      : scope === "product"
        ? targetLabel || "Un producto"
        : targetLabel || "Una categoría";
  const notch = {
    position: "absolute" as const,
    top: "50%",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "var(--bg, #14141a)",
    transform: "translateY(-50%)",
  };
  return (
    <div className="lg:sticky lg:top-2">
      <div className="text-faint mb-2 text-[12px]">Vista previa</div>
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid rgba(var(--gold-rgb),.35)",
          background:
            "linear-gradient(150deg, rgba(var(--gold-rgb),.16), rgba(var(--gold-rgb),.03))",
          opacity: isActive ? 1 : 0.55,
        }}
      >
        <div style={{ padding: "20px 18px 16px", textAlign: "center" }}>
          <div
            className="text-faint text-[11px] font-semibold"
            style={{ letterSpacing: 2 }}
          >
            {type === "percentage" ? "DESCUENTO" : "AHORRÁS"}
          </div>
          <div
            style={{
              fontSize: 44,
              lineHeight: 1.05,
              fontWeight: 800,
              color: "var(--gold-bright)",
            }}
          >
            {big}
          </div>
          <div className="text-dim text-[12px]">de descuento</div>
        </div>
        <div style={{ position: "relative", height: 1 }}>
          <div
            style={{
              borderTop: "2px dashed rgba(var(--gold-rgb),.35)",
              margin: "0 14px",
            }}
          />
          <span style={{ ...notch, left: -9 }} />
          <span style={{ ...notch, right: -9 }} />
        </div>
        <div style={{ padding: "16px 18px 20px" }}>
          <div
            className="mx-auto mb-3 text-center font-mono text-[15px] font-bold tracking-widest"
            style={{
              border: "1px dashed rgba(var(--gold-rgb),.5)",
              borderRadius: 8,
              padding: "8px 10px",
              color: "var(--fg)",
            }}
          >
            {code.trim().toUpperCase() || "TU-CÓDIGO"}
          </div>
          <div className="text-dim flex items-center justify-center gap-1.5 text-[12.5px]">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M20.6 13.4 12 22l-9-9V3h10z" />
              <circle cx="7.5" cy="7.5" r="1.5" />
            </svg>
            {scopeText}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {birthdayOnly ? (
              <span className="badge" style={{ fontSize: 11 }}>
                🎂 Cumpleaños
              </span>
            ) : null}
            {minPurchase > 0 ? (
              <span className="badge" style={{ fontSize: 11 }}>
                Mínimo ${minPurchase.toLocaleString("es-AR")}
              </span>
            ) : null}
            {expiresAt ? (
              <span className="badge" style={{ fontSize: 11 }}>
                Vence {expiresAt}
              </span>
            ) : null}
            {!isActive ? (
              <span className="badge" style={{ fontSize: 11 }}>
                Inactivo
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CouponForm({
  coupon,
  products = [],
  categories = [],
  onDone,
  onCancel,
}: {
  coupon?: CouponFormData;
  products?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const edit = !!coupon?.id;
  const [form, setForm] = useState({
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    type: coupon?.type ?? ("percentage" as "percentage" | "fixed"),
    value: coupon ? String(coupon.value) : "",
    maxUses: coupon?.maxUses != null ? String(coupon.maxUses) : "",
    expiresAt: toDateInput(coupon?.expiresAt ?? null),
    isActive: coupon?.isActive ?? true,
    scope: coupon?.scope ?? ("all" as "all" | "product" | "category"),
    targetId: coupon?.targetId ?? "",
    birthdayOnly: coupon?.birthdayOnly ?? false,
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prodQuery, setProdQuery] = useState("");
  const fe = useFormErrors();

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Wizard de 3 pasos. El paso 1 (Descuento) valida código + valor antes de
  // avanzar; el resto es opcional. El preview del ticket queda siempre visible.
  const [step, setStep] = useState(0);
  function next() {
    if (step === 0) {
      const ok = fe.check({
        code: !form.code.trim() ? "Ingresá un código." : null,
        value: !(Number(form.value) > 0) ? "Ingresá un valor mayor a 0." : null,
      });
      if (!ok) return;
    }
    setStep((s) => Math.min(2, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    setErr(null);
    const ok = fe.check({
      code: !form.code.trim() ? "Ingresá un código." : null,
      value: !(Number(form.value) > 0) ? "Ingresá un valor mayor a 0." : null,
    });
    if (!ok) return;
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
      scope: form.scope,
      targetId: form.scope === "all" ? "" : form.targetId,
      targetLabel:
        form.scope === "product"
          ? (products.find((p) => p.id === form.targetId)?.name ?? "")
          : form.scope === "category"
            ? (categories.find((c) => c.id === form.targetId)?.name ?? "")
            : "",
      birthdayOnly: form.birthdayOnly,
    };
    try {
      const res = await runAction(() => saveCouponAction(payload, coupon?.id), {
        silent: true,
      });
      if (!res.ok) return fe.fromAction(res.error);
      toast(edit ? "Cupón actualizado" : "Cupón creado", "success");
      onDone?.();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const previewTargetLabel =
    form.scope === "product"
      ? (products.find((p) => p.id === form.targetId)?.name ?? "")
      : form.scope === "category"
        ? (categories.find((c) => c.id === form.targetId)?.name ?? "")
        : "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
                  i === step
                    ? "bg-[var(--gold)] text-black"
                    : i < step
                      ? "bg-[rgba(var(--gold-rgb),.2)] text-[var(--gold-bright)]"
                      : "text-dim bg-[var(--surface-2)]"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span
                className={`hidden text-[12.5px] sm:inline ${
                  i === step ? "text-fg font-medium" : "text-faint"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {step === 0 ? (
          <>
            <div className={`field ${fe.errors.code ? "invalid" : ""}`}>
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
                aria-invalid={!!fe.errors.code}
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
              />
              {fe.errors.code ? (
                <p className="field-error">{fe.errors.code}</p>
              ) : null}
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

            <div className="field">
              <label>Tipo de descuento</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`chip flex-1 justify-center ${form.type === "percentage" ? "active" : ""}`}
                  onClick={() => set("type", "percentage")}
                >
                  <b style={{ fontSize: 15 }}>%</b> Porcentaje
                </button>
                <button
                  type="button"
                  className={`chip flex-1 justify-center ${form.type === "fixed" ? "active" : ""}`}
                  onClick={() => set("type", "fixed")}
                >
                  <b style={{ fontSize: 15 }}>$</b> Monto fijo
                </button>
              </div>
            </div>

            <div className="field">
              <label htmlFor="cp-value">
                Valor {form.type === "percentage" ? "(%)" : "($)"}
              </label>
              <input
                id="cp-value"
                type="number"
                className="input"
                placeholder={form.type === "percentage" ? "15" : "2000"}
                aria-invalid={!!fe.errors.value}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />
              {fe.errors.value ? (
                <p className="field-error">{fe.errors.value}</p>
              ) : null}
              <div className="text-faint text-[11.5px]">
                {form.type === "percentage"
                  ? "Un número de 1 a 100 (%)."
                  : "Un monto en pesos ($)."}
              </div>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="cp-scope">Aplica a</label>
              <select
                id="cp-scope"
                className="select"
                value={form.scope}
                onChange={(e) => {
                  set("scope", e.target.value);
                  set("targetId", "");
                }}
              >
                <option value="all">Todo el carrito</option>
                <option value="product">Un producto</option>
                <option value="category">Una categoría</option>
              </select>
              {form.scope === "product" ? (
                <div className="mt-2">
                  {products.find((p) => p.id === form.targetId) ? (
                    <div className="flex items-center gap-2">
                      <span className="chip active">
                        {products.find((p) => p.id === form.targetId)?.name}
                      </span>
                      <button
                        type="button"
                        className="text-[12px]"
                        style={{ color: "var(--gold-bright)" }}
                        onClick={() => {
                          set("targetId", "");
                          setProdQuery("");
                        }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="input"
                        placeholder="Buscar producto…"
                        value={prodQuery}
                        onChange={(e) => setProdQuery(e.target.value)}
                      />
                      {prodQuery.trim() ? (
                        <div className="mt-1 max-h-44 overflow-auto rounded-md border border-[var(--border)]">
                          {products
                            .filter((p) =>
                              p.name
                                .toLowerCase()
                                .includes(prodQuery.trim().toLowerCase()),
                            )
                            .slice(0, 30)
                            .map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-[var(--surface-2)]"
                                onClick={() => {
                                  set("targetId", p.id);
                                  setProdQuery("");
                                }}
                              >
                                {p.name}
                              </button>
                            ))}
                          {products.filter((p) =>
                            p.name
                              .toLowerCase()
                              .includes(prodQuery.trim().toLowerCase()),
                          ).length === 0 ? (
                            <div className="text-faint px-3 py-2 text-[12px]">
                              Sin resultados
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-faint mt-1 text-[11.5px]">
                          Escribí para buscar el producto.
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : form.scope === "category" ? (
                <select
                  className="select mt-2"
                  value={form.targetId}
                  onChange={(e) => set("targetId", e.target.value)}
                >
                  <option value="">— Elegí una categoría —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="text-faint text-[11.5px]">
                {form.scope === "all"
                  ? "El descuento se aplica a toda la compra."
                  : "El descuento se aplica SOLO a lo elegido."}
              </div>
            </div>

            <label className="text-fg flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--gold)]"
                checked={form.birthdayOnly}
                onChange={(e) => set("birthdayOnly", e.target.checked)}
              />
              Solo en la semana del cumpleaños del cliente
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="field">
              <label>Link directo (opcional)</label>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  readOnly
                  placeholder="Escribí el código primero"
                  value={
                    form.code.trim()
                      ? `${typeof window !== "undefined" ? window.location.origin : ""}/catalogo?cupon=${form.code.trim().toUpperCase()}`
                      : ""
                  }
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!form.code.trim()}
                  onClick={() => {
                    const url = `${window.location.origin}/catalogo?cupon=${form.code.trim().toUpperCase()}`;
                    void navigator.clipboard?.writeText(url);
                    toast("Link copiado", "success");
                  }}
                >
                  Copiar
                </button>
              </div>
              <div className="text-faint text-[11.5px]">
                Compartilo: al abrirlo, el cupón queda aplicado solo.
              </div>
            </div>

            <div className="field">
              <label htmlFor="cp-limit">Usos máximos</label>
              <input
                id="cp-limit"
                type="number"
                className="input"
                placeholder="Sin límite"
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
              />
              <div className="text-faint text-[11.5px]">
                Vacío = se puede usar sin límite.
              </div>
            </div>

            <div className="field">
              <label htmlFor="cp-exp">Vence el</label>
              <input
                id="cp-exp"
                type="date"
                className="input"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
              />
              <div className="text-faint text-[11.5px]">
                Vacío = sin fecha de vencimiento.
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
          </>
        ) : null}

        {err ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}

        <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={step === 0 ? () => onCancel?.() : back}
          >
            {step === 0 ? "Cancelar" : "← Atrás"}
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={next}>
              Siguiente →
            </Button>
          ) : (
            <Button type="button" onClick={submit} loading={busy}>
              {edit ? "Guardar" : "Crear cupón"}
            </Button>
          )}
        </div>
      </div>

      <CouponPreview
        code={form.code}
        type={form.type}
        value={form.value}
        scope={form.scope}
        targetLabel={previewTargetLabel}
        birthdayOnly={form.birthdayOnly}
        expiresAt={form.expiresAt}
        minPurchase={coupon?.minPurchase ?? 0}
        isActive={form.isActive}
      />
    </div>
  );
}
