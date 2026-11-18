"use client";

import { useState } from "react";
import { EstimatorModalButton } from "@/features/calculator/components/estimator-modal-button";
import type { EstimatorValue } from "@/features/calculator/components/price-estimator";
import type { EstimatorContext } from "@/features/calculator/service";
import {
  formatQuoteMoney,
  type QuoteDefaults,
} from "@/features/quotes/build-quote";
import { runAction } from "@/lib/run-action";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { answerInquiryAction } from "../actions";
import { buildInquiryMessage } from "../message";
import type { InquiryView } from "../view";

const numOrNull = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/** Lo que dejó la calculadora: con esto se costea el pedido al confirmar. */
type Calc = {
  filamentId: string | null;
  material: string | null;
  grams: number;
  printMinutes: number;
};

/**
 * Respuesta del operador (pedido de Ale, 2026-11-17).
 *
 * - El precio sale de la CALCULADORA: gramos, horas, filamento y el TIPO de
 *   producto, que lleva el porcentaje de ganancia que carga Ale. El operador
 *   no ve ni el costo ni el porcentaje: solo el precio. Lo que calculó queda
 *   guardado para costear el pedido y descontar el filamento al confirmar.
 * - Puede poner el precio POR UNIDAD o POR EL TOTAL de la cantidad pedida
 *   (para cuando se cotiza "el lote"): se guarda siempre el precio por unidad.
 * - Abajo ve EN VIVO el mensaje que le llega armado a atención al cliente.
 *   Puede retocarlo; mientras no lo toque, se rearma solo con cada cambio.
 */
export function AnswerForm({
  inquiry,
  defaults,
  estimator,
  onDone,
}: {
  inquiry: InquiryView;
  defaults: QuoteDefaults;
  estimator: EstimatorContext;
  onDone: () => void;
}) {
  const qty = inquiry.quantity;
  const [mode, setMode] = useState<"unit" | "total">("unit");
  // El campo muestra lo que el operador está cargando: unidad o total.
  const [priceText, setPriceText] = useState(
    inquiry.unitPrice != null ? String(inquiry.unitPrice) : "",
  );
  const [calc, setCalc] = useState<Calc | null>(
    inquiry.estGrams != null || inquiry.estMinutes != null
      ? {
          filamentId: inquiry.estFilamentId,
          material: inquiry.estMaterial,
          grams: inquiry.estGrams ?? 0,
          printMinutes: inquiry.estMinutes ?? 0,
        }
      : null,
  );
  const [bulkPrice, setBulkPrice] = useState(
    inquiry.bulkPrice != null ? String(inquiry.bulkPrice) : "",
  );
  const [bulkFrom, setBulkFrom] = useState(
    inquiry.bulkFrom != null ? String(inquiry.bulkFrom) : "",
  );
  const [dimensions, setDimensions] = useState(inquiry.dimensions ?? "");
  const [colors, setColors] = useState(inquiry.colors ?? "");
  const [deliveryTime, setDeliveryTime] = useState(inquiry.deliveryTime ?? "");
  const [note, setNote] = useState(inquiry.answerNote ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const typed = numOrNull(priceText);
  const unitPrice =
    typed == null ? null : mode === "total" ? typed / qty : typed;

  function changeMode(next: "unit" | "total") {
    if (next === mode) return;
    // Mismo precio, expresado de la otra forma.
    if (typed != null) {
      const value = next === "total" ? typed * qty : typed / qty;
      setPriceText(String(Math.round(value * 100) / 100));
    }
    setMode(next);
  }

  function applyCalc(v: EstimatorValue) {
    // La calculadora cotiza UNA pieza.
    if (v.price != null) {
      setPriceText(String(mode === "total" ? v.price * qty : v.price));
    }
    setCalc({
      filamentId: v.filamentId,
      material: v.material || null,
      grams: v.grams,
      printMinutes: v.printMinutes,
    });
  }

  const auto = buildInquiryMessage(
    {
      title: inquiry.title,
      quantity: qty,
      unitPrice: unitPrice ?? 0,
      bulkPrice: numOrNull(bulkPrice),
      bulkFrom: numOrNull(bulkFrom),
      dimensions,
      colors,
      deliveryTime,
      note,
    },
    defaults,
  );
  // null = sigue al automático. Si ya había una respuesta guardada distinta
  // del automático, es porque el operador la retocó: se respeta.
  const [custom, setCustom] = useState<string | null>(
    inquiry.message && inquiry.message !== auto ? inquiry.message : null,
  );
  const message = custom ?? auto;

  async function save() {
    if (busy) return;
    setErrors({});
    setBusy(true);
    try {
      const res = await runAction(
        () =>
          answerInquiryAction(inquiry.id, {
            unitPrice: unitPrice ?? "",
            // Respuestas viejas, cargadas con el costo a mano: se conserva.
            unitCost: calc ? null : inquiry.unitCost,
            filamentId: calc?.filamentId ?? null,
            material: calc?.material ?? null,
            grams: calc?.grams ?? null,
            printMinutes: calc?.printMinutes ?? null,
            bulkPrice,
            bulkFrom,
            dimensions,
            colors,
            deliveryTime,
            note,
            // Sin retoque a mano va vacío: el servidor arma el mismo texto.
            message: custom,
          }),
        { label: "Guardando…", silent: true },
      );
      if (!res.ok) {
        setErrors(res.error.fields ?? { _: res.error.message });
        return;
      }
      toast("Respuesta enviada", "success");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  const hasCost = calc != null || inquiry.unitCost != null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-dim text-sm">
        {inquiry.customerName} pide{" "}
        <b className="text-fg">
          {qty > 1 ? `${qty} × ` : ""}
          {inquiry.title}
        </b>
      </p>
      {errors._ ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {errors._}
        </p>
      ) : null}

      <div
        className={`field ${errors.unitPrice || errors.calc ? "invalid" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="ans-price">Precio</label>
          {qty > 1 ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={cn("chip", mode === "unit" && "active")}
                aria-pressed={mode === "unit"}
                onClick={() => changeMode("unit")}
              >
                Por unidad
              </button>
              <button
                type="button"
                className={cn("chip", mode === "total" && "active")}
                aria-pressed={mode === "total"}
                onClick={() => changeMode("total")}
              >
                Por las {qty}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="ans-price"
            className="input max-w-[12rem]"
            type="number"
            inputMode="decimal"
            min={0}
            value={priceText}
            placeholder={mode === "total" ? "$ por todas" : "$ por unidad"}
            aria-invalid={errors.unitPrice ? true : undefined}
            onChange={(e) => setPriceText(e.target.value)}
          />
          <EstimatorModalButton
            estimator={estimator}
            label={calc ? "Volver a calcular" : "Calcular precio"}
            initial={
              calc
                ? {
                    material: calc.material ?? undefined,
                    grams: calc.grams || undefined,
                    printMinutes: calc.printMinutes || undefined,
                  }
                : undefined
            }
            onUse={applyCalc}
          />
        </div>
        {unitPrice != null && qty > 1 ? (
          <p className="text-dim text-xs">
            {formatQuoteMoney(unitPrice)} c/u ·{" "}
            {formatQuoteMoney(unitPrice * qty)} por las {qty}
          </p>
        ) : null}
        {errors.unitPrice ? (
          <p className="field-error">{errors.unitPrice}</p>
        ) : null}
        {errors.calc ? (
          <p className="field-error">{errors.calc}</p>
        ) : (
          <p className="text-faint text-xs">
            {hasCost
              ? "Costo guardado con la calculadora. Podés ajustar el precio a mano."
              : "Calculá el precio con la calculadora: elegís el tipo de producto y queda guardado el costo para cuando se confirme el pedido."}
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="ans-delivery">Demora estimada</label>
          <input
            id="ans-delivery"
            className="input"
            value={deliveryTime}
            maxLength={120}
            placeholder="Ej.: 3 a 5 días hábiles"
            onChange={(e) => setDeliveryTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ans-dims">Medidas</label>
          <input
            id="ans-dims"
            className="input"
            value={dimensions}
            maxLength={300}
            placeholder="Ej.: Alto: 9 cm, Ancho: 5 cm"
            onChange={(e) => setDimensions(e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className={`field ${errors.bulkPrice ? "invalid" : ""}`}>
          <label htmlFor="ans-bulk">Precio por cantidad (opcional)</label>
          <input
            id="ans-bulk"
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            value={bulkPrice}
            placeholder="$ c/u"
            onChange={(e) => setBulkPrice(e.target.value)}
          />
          {errors.bulkPrice ? (
            <p className="field-error">{errors.bulkPrice}</p>
          ) : null}
        </div>
        <div className={`field ${errors.bulkFrom ? "invalid" : ""}`}>
          <label htmlFor="ans-bulk-from">A partir de cuántas unidades</label>
          <input
            id="ans-bulk-from"
            className="input"
            type="number"
            inputMode="numeric"
            min={2}
            value={bulkFrom}
            placeholder="Ej.: 10"
            onChange={(e) => setBulkFrom(e.target.value)}
          />
          {errors.bulkFrom ? (
            <p className="field-error">{errors.bulkFrom}</p>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="ans-colors">Colores</label>
        <input
          id="ans-colors"
          className="input"
          value={colors}
          maxLength={300}
          placeholder="Ej.: Blanco, Negro"
          onChange={(e) => setColors(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="ans-note">Aclaración para el cliente (opcional)</label>
        <textarea
          id="ans-note"
          className="textarea"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className={`field ${errors.message ? "invalid" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="ans-message">Mensaje para el cliente</label>
          {custom != null ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCustom(null)}
            >
              Volver a armarlo solo
            </button>
          ) : (
            <span className="text-faint text-xs">Se arma solo</span>
          )}
        </div>
        <textarea
          id="ans-message"
          className="textarea"
          rows={12}
          maxLength={6000}
          value={message}
          style={{ fontSize: 13, lineHeight: 1.45 }}
          onChange={(e) => setCustom(e.target.value)}
        />
        {errors.message ? (
          <p className="field-error">{errors.message}</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onDone}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          Enviar respuesta
        </button>
      </div>
    </div>
  );
}
