"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveBusinessInfoAction } from "../actions";
import type { BusinessSettings } from "../types";
import { runAction } from "@/lib/run-action";

type Shift = { on: boolean; from: string; to: string };
type Hour = { label: string; morning: Shift; afternoon: Shift };
const OFF: Shift = { on: false, from: "", to: "" };
const DEFAULT_HOURS: Hour[] = [
  {
    label: "Lun a Vie",
    morning: { on: true, from: "09:00", to: "13:00" },
    afternoon: { on: true, from: "16:00", to: "20:00" },
  },
  {
    label: "Sábados",
    morning: { on: true, from: "09:00", to: "13:00" },
    afternoon: { ...OFF },
  },
  { label: "Domingos", morning: { ...OFF }, afternoon: { ...OFF } },
];

// Acepta el formato nuevo (mañana/tarde) o el viejo ({from,to,on}) y devuelve
// siempre el nuevo: el rango viejo pasa al turno "mañana".
function normalizeHours(raw: unknown): Hour[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_HOURS;
  const toShift = (s: unknown): Shift => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      on: Boolean(o.on),
      from: String(o.from ?? ""),
      to: String(o.to ?? ""),
    };
  };
  return raw.map((r) => {
    const h = (r ?? {}) as Record<string, unknown>;
    const label = String(h.label ?? "");
    if (h.morning || h.afternoon) {
      return {
        label,
        morning: toShift(h.morning),
        afternoon: toShift(h.afternoon),
      };
    }
    return { label, morning: toShift(h), afternoon: { ...OFF } };
  });
}

// Fila de un turno (Mañana/Tarde). Responsive: envuelve en pantallas chicas.
function ShiftRow({
  label,
  shift,
  onToggle,
  onChange,
}: {
  label: string;
  shift: Shift;
  onToggle: () => void;
  onChange: (patch: Partial<Shift>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={shift.on}
        aria-label={label}
        className={`switch ${shift.on ? "on" : ""}`}
        onClick={onToggle}
      />
      <span className="text-faint text-[12.5px]" style={{ width: 46 }}>
        {label}
      </span>
      {shift.on ? (
        <div className="flex items-center gap-1">
          <input
            type="time"
            className="input"
            style={{ width: "auto", padding: "6px 9px" }}
            value={shift.from}
            onChange={(e) => onChange({ from: e.target.value })}
          />
          <span className="text-faint">a</span>
          <input
            type="time"
            className="input"
            style={{ width: "auto", padding: "6px 9px" }}
            value={shift.to}
            onChange={(e) => onChange({ to: e.target.value })}
          />
        </div>
      ) : (
        <span className="text-faint text-[12px]">Cerrado</span>
      )}
    </div>
  );
}

export function BusinessConfigForm({
  settings,
}: {
  settings: BusinessSettings | null;
}) {
  const [form, setForm] = useState({
    storeName: settings?.storeName ?? "",
    slogan: settings?.slogan ?? "",
    contactEmail: settings?.contactEmail ?? "",
    whatsapp: settings?.whatsapp ?? "",
    cuit: settings?.cuit ?? "",
    instagram: settings?.instagram ?? "",
    facebook: settings?.facebook ?? "",
    addressText: settings?.addressText ?? "",
    description: settings?.description ?? "",
  });
  const [hours, setHours] = useState<Hour[]>(() =>
    normalizeHours(settings?.hours),
  );
  const [pickup, setPickup] = useState(settings?.pickupEnabled ?? true);
  const [delivery, setDelivery] = useState(settings?.deliveryEnabled ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setLabel = (i: number, label: string) =>
    setHours((hs) => hs.map((h, j) => (j === i ? { ...h, label } : h)));
  const setShift = (
    i: number,
    key: "morning" | "afternoon",
    patch: Partial<Shift>,
  ) =>
    setHours((hs) =>
      hs.map((h, j) =>
        j === i ? { ...h, [key]: { ...h[key], ...patch } } : h,
      ),
    );

  async function submit() {
    setErr(null);
    if (!form.storeName.trim()) return setErr("Ingresá el nombre del negocio.");
    if (form.contactEmail && !/.+@.+\..+/.test(form.contactEmail))
      return setErr("El email no es válido.");
    setBusy(true);
    try {
      const res = await runAction(
        () =>
          saveBusinessInfoAction({
            ...form,
            hours,
            pickupEnabled: pickup,
            deliveryEnabled: delivery,
          }),
        { silent: true },
      );
      if (!res.ok) return setErr(res.error.message);
      toast("Datos del negocio guardados", "success");
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      {/* Columna 1 — Información del negocio (paneles apilados en tablet; lado
          a lado en desktop ≥1024, porque el sidebar reduce el ancho útil). */}
      <div className="ui-card section-card flex flex-col gap-4">
        <div className="section-title">Información del negocio</div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="b-name">Nombre comercial</label>
            <input
              id="b-name"
              className="input"
              value={form.storeName}
              onChange={(e) => set("storeName", e.target.value)}
              placeholder="Hefesto 3D"
            />
          </div>
          <div className="field">
            <label htmlFor="b-slogan">Eslogan</label>
            <input
              id="b-slogan"
              className="input"
              value={form.slogan}
              onChange={(e) => set("slogan", e.target.value)}
              placeholder="Forjado en capas"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="b-email">Email de contacto</label>
          <input
            id="b-email"
            type="email"
            className="input"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            placeholder="hola@hefesto3d.com"
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="b-wa">WhatsApp</label>
            <input
              id="b-wa"
              className="input"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="+54 11 ..."
            />
          </div>
          <div className="field">
            <label htmlFor="b-cuit">CUIT</label>
            <input
              id="b-cuit"
              className="input"
              value={form.cuit}
              onChange={(e) => set("cuit", e.target.value)}
              placeholder="30-71845512-3"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="b-desc">Descripción</label>
          <textarea
            id="b-desc"
            className="textarea"
            rows={6}
            style={{ minHeight: 150, resize: "vertical" }}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Contá de qué se trata tu negocio, qué imprimís, tu diferencial…"
          />
        </div>
      </div>

      {/* Columna 2 — Redes y envíos */}
      <div className="ui-card section-card flex flex-col gap-3">
        <div className="section-title">Redes y envíos</div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="b-ig">Instagram</label>
            <input
              id="b-ig"
              className="input"
              value={form.instagram}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder="@hefesto3d"
            />
          </div>
          <div className="field">
            {/* Reusamos la columna `facebook` para guardar el TikTok (sin
                migración; misma idea que color_prices). Solo cambia la etiqueta. */}
            <label htmlFor="b-tt">TikTok</label>
            <input
              id="b-tt"
              className="input"
              value={form.facebook}
              onChange={(e) => set("facebook", e.target.value)}
              placeholder="@hefesto3d"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="b-addr">Dirección del taller</label>
          <input
            id="b-addr"
            className="input"
            value={form.addressText}
            onChange={(e) => set("addressText", e.target.value)}
            placeholder="Av. Victoria Aguirre 320, Puerto Iguazú"
          />
        </div>
        <div className="field">
          <label>Horario de atención</label>
          <div className="flex flex-col gap-2">
            {hours.map((h, i) => {
              const closed = !h.morning.on && !h.afternoon.on;
              return (
                <div
                  key={i}
                  className="ui-card flex flex-col gap-2.5"
                  style={{ padding: "10px 12px" }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      className="input font-semibold"
                      style={{ maxWidth: 150, padding: "6px 9px" }}
                      value={h.label}
                      onChange={(e) => setLabel(i, e.target.value)}
                    />
                    {closed ? (
                      <span className="badge badge-neutral ml-auto">
                        Cerrado
                      </span>
                    ) : null}
                  </div>
                  <ShiftRow
                    label="Mañana"
                    shift={h.morning}
                    onToggle={() =>
                      setShift(i, "morning", { on: !h.morning.on })
                    }
                    onChange={(patch) => setShift(i, "morning", patch)}
                  />
                  <ShiftRow
                    label="Tarde"
                    shift={h.afternoon}
                    onToggle={() =>
                      setShift(i, "afternoon", { on: !h.afternoon.on })
                    }
                    onChange={(patch) => setShift(i, "afternoon", patch)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="ui-card flex items-center justify-between"
          style={{ padding: "14px 16px" }}
        >
          <div>
            <div className="text-[13.5px] font-semibold">Retiro en local</div>
            <div className="text-faint text-[12px]">
              Permitir pickup gratuito.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={pickup}
            aria-label="Retiro en local"
            className={`switch ${pickup ? "on" : ""}`}
            onClick={() => setPickup((v) => !v)}
          />
        </div>
        <div
          className="ui-card flex items-center justify-between"
          style={{ padding: "14px 16px" }}
        >
          <div>
            <div className="text-[13.5px] font-semibold">Envío a domicilio</div>
            <div className="text-faint text-[12px]">
              Habilitar envíos (se configuran en la pestaña Envíos).
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={delivery}
            aria-label="Envío a domicilio"
            className={`switch ${delivery ? "on" : ""}`}
            onClick={() => setDelivery((v) => !v)}
          />
        </div>

        {err ? (
          <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
            {err}
          </p>
        ) : null}
        <Button type="button" onClick={submit} loading={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
