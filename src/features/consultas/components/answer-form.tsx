"use client";

import { useState } from "react";
import type { QuoteDefaults } from "@/features/quotes/build-quote";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { answerInquiryAction } from "../actions";
import { buildInquiryMessage } from "../message";
import type { InquiryView } from "../view";

const numOrNull = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Respuesta del operador. Carga el precio y los datos, y abajo ve EN VIVO el
 * mensaje que le va a llegar armado a atención al cliente. Puede retocarlo a
 * mano; mientras no lo toque, se rearma solo con cada cambio.
 */
export function AnswerForm({
  inquiry,
  defaults,
  onDone,
}: {
  inquiry: InquiryView;
  defaults: QuoteDefaults;
  onDone: () => void;
}) {
  const [unitPrice, setUnitPrice] = useState(
    inquiry.unitPrice != null ? String(inquiry.unitPrice) : "",
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

  const auto = buildInquiryMessage(
    {
      title: inquiry.title,
      quantity: inquiry.quantity,
      unitPrice: numOrNull(unitPrice) ?? 0,
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
            unitPrice,
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-dim text-sm">
        {inquiry.customerName} pide{" "}
        <b className="text-fg">
          {inquiry.quantity > 1 ? `${inquiry.quantity} × ` : ""}
          {inquiry.title}
        </b>
      </p>
      {errors._ ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {errors._}
        </p>
      ) : null}

      <div className="grid-2">
        <div className={`field ${errors.unitPrice ? "invalid" : ""}`}>
          <label htmlFor="ans-price">Precio por unidad ($)</label>
          <input
            id="ans-price"
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            value={unitPrice}
            aria-invalid={errors.unitPrice ? true : undefined}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          {errors.unitPrice ? (
            <p className="field-error">{errors.unitPrice}</p>
          ) : null}
        </div>
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

      <div className="grid-2">
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
