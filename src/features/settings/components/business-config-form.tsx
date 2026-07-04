"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveBusinessInfoAction } from "../actions";
import type { BusinessSettings } from "../types";

type Hour = { label: string; from: string; to: string; on: boolean };
const DEFAULT_HOURS: Hour[] = [
  { label: "Lun a Vie", from: "09:00", to: "19:00", on: true },
  { label: "Sábados", from: "09:00", to: "13:00", on: true },
  { label: "Domingos", from: "", to: "", on: false },
];

export function BusinessConfigForm({
  settings,
}: {
  settings: BusinessSettings | null;
}) {
  const router = useRouter();
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
  const [hours, setHours] = useState<Hour[]>(
    settings?.hours && settings.hours.length > 0
      ? settings.hours
      : DEFAULT_HOURS,
  );
  const [pickup, setPickup] = useState(settings?.pickupEnabled ?? true);
  const [delivery, setDelivery] = useState(settings?.deliveryEnabled ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setHour = (i: number, patch: Partial<Hour>) =>
    setHours((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));

  async function submit() {
    setErr(null);
    if (!form.storeName.trim()) return setErr("Ingresá el nombre del negocio.");
    if (form.contactEmail && !/.+@.+\..+/.test(form.contactEmail))
      return setErr("El email no es válido.");
    setBusy(true);
    try {
      const res = await saveBusinessInfoAction({
        ...form,
        hours,
        pickupEnabled: pickup,
        deliveryEnabled: delivery,
      });
      if (!res.ok) return setErr(res.error.message);
      toast("Datos del negocio guardados", "success");
      router.refresh();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      {/* Columna 1 — Información del negocio */}
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
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Impresión 3D a pedido…"
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
            <label htmlFor="b-fb">Facebook</label>
            <input
              id="b-fb"
              className="input"
              value={form.facebook}
              onChange={(e) => set("facebook", e.target.value)}
              placeholder="hefesto3d"
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
            {hours.map((h, i) => (
              <div
                key={i}
                className="ui-card flex items-center gap-2"
                style={{ padding: "9px 12px" }}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={h.on}
                  aria-label={h.label}
                  className={`switch ${h.on ? "on" : ""}`}
                  onClick={() => setHour(i, { on: !h.on })}
                />
                <input
                  className="input"
                  style={{ width: 110, padding: "6px 9px" }}
                  value={h.label}
                  onChange={(e) => setHour(i, { label: e.target.value })}
                />
                <div className="ml-auto flex items-center gap-1">
                  {h.on ? (
                    <>
                      <input
                        type="time"
                        className="input"
                        style={{ width: "auto", padding: "6px 9px" }}
                        value={h.from}
                        onChange={(e) => setHour(i, { from: e.target.value })}
                      />
                      <span className="text-faint">a</span>
                      <input
                        type="time"
                        className="input"
                        style={{ width: "auto", padding: "6px 9px" }}
                        value={h.to}
                        onChange={(e) => setHour(i, { to: e.target.value })}
                      />
                    </>
                  ) : (
                    <span className="badge badge-neutral">Cerrado</span>
                  )}
                </div>
              </div>
            ))}
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
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
