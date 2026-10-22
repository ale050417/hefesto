"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { buildWhatsappUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import {
  buildQuoteText,
  type QuoteDefaults,
  type QuoteDraft,
  type QuotePrice,
} from "../build-quote";
import { saveQuoteDefaultsAction } from "../actions";

/**
 * Botón + modal "Cotización" (pedido de Ale, 2026-10-21): arma el mensaje
 * de WhatsApp con el formato de Antonella a partir del producto o la venta,
 * deja retocar cada parte (medidas, precios por cantidad, colores, seña,
 * aclaraciones), y lo copia o lo manda por WhatsApp de una. Los textos fijos
 * (encabezado, seña, aclaraciones) se guardan como predeterminados para que
 * nadie los escriba de cero.
 */

const QuoteIcon = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20l1-4.9A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4z" />
    <path d="M8 10h8M8 13.5h5" />
  </svg>
);

export function QuoteButton({
  initial,
  defaults,
  phone,
  variant = "icon",
  label = "Cotización",
  className,
}: {
  initial: QuoteDraft;
  defaults: QuoteDefaults;
  phone?: string | null;
  variant?: "icon" | "button";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          className={cn("btn-icon btn-ghost", className)}
          title="Cotización para WhatsApp"
          aria-label={`Cotización de ${initial.product || "la venta"}`}
          onClick={() => setOpen(true)}
        >
          {QuoteIcon}
        </button>
      ) : (
        <button
          type="button"
          className={cn("btn btn-secondary btn-sm", className)}
          onClick={() => setOpen(true)}
        >
          {QuoteIcon}
          {label}
        </button>
      )}
      <QuoteModal
        open={open}
        onClose={() => setOpen(false)}
        initial={initial}
        defaults={defaults}
        phone={phone}
      />
    </>
  );
}

type PriceRow = { label: string; amount: string; suffix: string };

function toRows(prices: QuotePrice[]): PriceRow[] {
  return prices.map((p) => ({
    label: p.label,
    amount: String(Math.round(p.amount)),
    suffix: p.suffix ?? "",
  }));
}

export function QuoteModal({
  open,
  onClose,
  initial,
  defaults,
  phone,
  title = "Cotización para WhatsApp",
}: {
  open: boolean;
  onClose: () => void;
  initial: QuoteDraft;
  defaults: QuoteDefaults;
  phone?: string | null;
  title?: string;
}) {
  // El Modal desmonta su contenido al cerrarse: el formulario arranca de
  // cero (desde `initial`) en cada apertura sin efectos ni resets a mano.
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <QuoteForm initial={initial} defaults={defaults} phone={phone} />
    </Modal>
  );
}

function QuoteForm({
  initial,
  defaults,
  phone,
}: {
  initial: QuoteDraft;
  defaults: QuoteDefaults;
  phone?: string | null;
}) {
  const [product, setProduct] = useState(initial.product);
  const [dims, setDims] = useState(initial.dimensions.join("\n"));
  const [dimsInImage, setDimsInImage] = useState(!!initial.dimensionsNote);
  const [rows, setRows] = useState<PriceRow[]>(toRows(initial.prices));
  const [colors, setColors] = useState(initial.colors.join(", "));
  const [depositOn, setDepositOn] = useState(initial.depositPct != null);
  const [depositPct, setDepositPct] = useState(
    String(initial.depositPct ?? defaults.depositPct),
  );
  const [depositText, setDepositText] = useState(initial.depositText);
  const [notesOn, setNotesOn] = useState<boolean[]>(
    defaults.notes.map((n) => initial.notes.includes(n)),
  );
  const [extra, setExtra] = useState(initial.extra ?? "");
  const [to, setTo] = useState(phone ?? "");
  const [copied, setCopied] = useState(false);
  const [editDefaults, setEditDefaults] = useState(false);
  const [dTitle, setDTitle] = useState(defaults.title);
  const [dPct, setDPct] = useState(String(defaults.depositPct));
  const [dText, setDText] = useState(defaults.depositText);
  const [dNotes, setDNotes] = useState(defaults.notes.join("\n"));
  const [saving, setSaving] = useState(false);

  const draft = useMemo<QuoteDraft>(
    () => ({
      product,
      dimensions: dimsInImage
        ? []
        : dims
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
      dimensionsNote: dimsInImage ? "En la imagen adjuntada." : undefined,
      prices: rows
        .map((r) => ({
          label: r.label,
          amount: Number(r.amount.replace(/[^\d]/g, "")),
          suffix: r.suffix.trim() || undefined,
        }))
        .filter((p) => p.amount > 0),
      colors: colors
        .split(/[,\n]/)
        .map((c) => c.trim())
        .filter(Boolean),
      depositPct: depositOn ? Number(depositPct) || 0 : null,
      depositText,
      notes: defaults.notes.filter((_, i) => notesOn[i]),
      extra,
    }),
    [
      product,
      dims,
      dimsInImage,
      rows,
      colors,
      depositOn,
      depositPct,
      depositText,
      notesOn,
      extra,
      defaults.notes,
    ],
  );
  const text = useMemo(
    () => buildQuoteText(draft, { ...defaults, title: dTitle }),
    [draft, defaults, dTitle],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Cotización copiada", "success");
    } catch {
      toast("No se pudo copiar; seleccioná el texto y copialo.", "danger");
    }
  }

  function setRow(i: number, patch: Partial<PriceRow>) {
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  async function saveDefaults() {
    setSaving(true);
    const res = await runAction(
      () =>
        saveQuoteDefaultsAction({
          title: dTitle,
          depositPct: Number(dPct) || 0,
          depositText: dText,
          notes: dNotes
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean),
        }),
      { silent: true, overlay: false },
    );
    setSaving(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Textos guardados: se usan en las próximas cotizaciones", "success");
    setEditDefaults(false);
  }

  return (
    <div className="quote-grid">
      {/* Columna de edición */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="field">
          <label htmlFor="q-prod">Producto</label>
          <input
            id="q-prod"
            className="input"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          />
        </div>

        <div className="field">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="q-dims" className="mb-0">
              Dimensiones aproximadas
            </label>
            <label className="text-dim flex items-center gap-1.5 text-[12px]">
              <input
                type="checkbox"
                className="accent-[var(--gold)]"
                checked={dimsInImage}
                onChange={(e) => setDimsInImage(e.target.checked)}
              />
              En la imagen adjuntada
            </label>
          </div>
          <textarea
            id="q-dims"
            className="textarea"
            rows={3}
            disabled={dimsInImage}
            placeholder={"Alto: 9 cm\nAncho: 7 cm\nGrosor: 2 mm"}
            value={dims}
            onChange={(e) => setDims(e.target.value)}
          />
          <div className="text-faint text-[11.5px]">Una medida por línea.</div>
        </div>

        <div className="field">
          <label className="mb-0">Precio</label>
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <div key={i} className="quote-price-row">
                <input
                  className="input"
                  aria-label="Etiqueta del precio"
                  value={r.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                />
                <span className="text-faint text-[12px]">$</span>
                <input
                  className="input"
                  aria-label="Monto"
                  inputMode="numeric"
                  value={r.amount}
                  onChange={(e) => setRow(i, { amount: e.target.value })}
                />
                <input
                  className="input"
                  aria-label="Sufijo"
                  placeholder="c/u"
                  value={r.suffix}
                  onChange={(e) => setRow(i, { suffix: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  aria-label="Quitar precio"
                  onClick={() =>
                    setRows((prev) => prev.filter((_, k) => k !== i))
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { label: "Precio", amount: "", suffix: "" },
                ])
              }
            >
              + Precio
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              title="Escalón por cantidad: precio más bajo a partir de X unidades"
              onClick={() =>
                setRows((prev) => [
                  ...prev.map((r, i) =>
                    i === 0 && r.label === "Precio"
                      ? { ...r, label: "Precio (Por unidad)", suffix: "c/u" }
                      : r,
                  ),
                  {
                    label: "Precio (A partir de 10 unidades)",
                    amount: "",
                    suffix: "c/u",
                  },
                ])
              }
            >
              + Por cantidad
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="q-colors">Colores con similitud</label>
          <input
            id="q-colors"
            className="input"
            placeholder="Blanco, Verde Olivo, Verde Militar"
            value={colors}
            onChange={(e) => setColors(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="text-dim flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[var(--gold)]"
              checked={depositOn}
              onChange={(e) => setDepositOn(e.target.checked)}
            />
            Seña
            <input
              className="input"
              style={{ width: 70, padding: "6px 8px" }}
              inputMode="numeric"
              aria-label="Porcentaje de seña"
              disabled={!depositOn}
              value={depositPct}
              onChange={(e) => setDepositPct(e.target.value)}
            />
            <span className="text-faint text-[12px]">%</span>
          </label>
          <input
            className="input"
            disabled={!depositOn}
            value={depositText}
            onChange={(e) => setDepositText(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Aclaraciones</label>
          {defaults.notes.map((n, i) => (
            <label
              key={i}
              className="text-dim flex items-start gap-2 text-[12.5px] leading-snug"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-[var(--gold)]"
                checked={!!notesOn[i]}
                onChange={(e) =>
                  setNotesOn((prev) =>
                    prev.map((v, k) => (k === i ? e.target.checked : v)),
                  )
                }
              />
              <span>{n}</span>
            </label>
          ))}
          <textarea
            className="textarea"
            rows={2}
            placeholder="Algo más para esta cotización (tiempo de entrega, envío…)"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm self-start"
          onClick={() => setEditDefaults((v) => !v)}
        >
          {editDefaults
            ? "Ocultar textos por defecto"
            : "Editar textos por defecto…"}
        </button>
        {editDefaults ? (
          <div className="quote-defaults">
            <div className="field">
              <label>Encabezado</label>
              <input
                className="input"
                value={dTitle}
                onChange={(e) => setDTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <div className="field">
                <label>Seña %</label>
                <input
                  className="input"
                  inputMode="numeric"
                  value={dPct}
                  onChange={(e) => setDPct(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Texto de la seña</label>
                <input
                  className="input"
                  value={dText}
                  onChange={(e) => setDText(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Aclaraciones (una por línea)</label>
              <textarea
                className="textarea"
                rows={4}
                value={dNotes}
                onChange={(e) => setDNotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm self-start"
              disabled={saving}
              onClick={saveDefaults}
            >
              {saving ? "Guardando…" : "Guardar como textos por defecto"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Vista previa + envío */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="text-dim text-[12.5px] font-semibold">
          Así le llega al cliente
        </div>
        <pre className="quote-preview">{text}</pre>
        <div className="field">
          <label htmlFor="q-to">WhatsApp del cliente (opcional)</label>
          <input
            id="q-to"
            className="input"
            inputMode="tel"
            placeholder="Ej: 3757 123456"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copied ? "Copiada ✓" : "Copiar cotización"}
          </button>
          <a
            className="btn btn-secondary"
            href={buildWhatsappUrl(to.trim() || null, text)}
            target="_blank"
            rel="noreferrer"
          >
            Mandar por WhatsApp
          </a>
        </div>
        <div className="text-faint text-[11.5px] leading-snug">
          Sin número, WhatsApp abre para que elijas el chat. Si la cotización
          lleva foto, adjuntala después de pegar el texto.
        </div>
      </div>
    </div>
  );
}
