"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveShippingSettingsAction } from "../actions";
import type { ShippingSettings } from "../types";
import { runAction } from "@/lib/run-action";

type Zone = { name: string; price: string };

export function ShippingSettingsForm({
  settings,
}: {
  settings: ShippingSettings | null;
}) {
  const [city, setCity] = useState(settings?.city ?? "");
  const [freeOver, setFreeOver] = useState(
    settings?.freeOver != null ? String(Number(settings.freeOver)) : "",
  );
  const [outMsg, setOutMsg] = useState(settings?.outMsg ?? "");
  const [zones, setZones] = useState<Zone[]>(
    (settings?.zones ?? []).map((z) => ({
      name: z.name,
      price: String(z.price),
    })),
  );
  const [busy, setBusy] = useState(false);

  const setZone = (i: number, patch: Partial<Zone>) =>
    setZones((zs) => zs.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  const addZone = () => setZones((zs) => [...zs, { name: "", price: "" }]);
  const delZone = (i: number) => setZones((zs) => zs.filter((_, j) => j !== i));

  async function submit() {
    setBusy(true);
    try {
      const res = await runAction(
        () =>
          saveShippingSettingsAction({
            city,
            freeOver: Number(freeOver) || 0,
            outMsg,
            zones: zones
              .filter((z) => z.name.trim())
              .map((z) => ({ name: z.name, price: Number(z.price) || 0 })),
          }),
        { silent: true },
      );
      if (!res.ok) return toast(res.error.message, "danger");
      toast("Envíos guardados", "success");
    } catch {
      toast("No se pudo guardar. Intentá de nuevo.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="ui-card section-card flex flex-col gap-3">
        <div className="section-title">Envíos y retiro</div>
        <div className="text-faint -mt-2 text-[12.5px]">
          Precio del envío por barrio. Fuera de tu ciudad se coordina por chat y
          el costo queda a cargo del comprador.
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Ciudad de envío</label>
            <input
              className="input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Iguazú"
            />
          </div>
          <div className="field">
            <label>Envío gratis desde (ARS)</label>
            <input
              className="input"
              type="number"
              value={freeOver}
              onChange={(e) => setFreeOver(e.target.value)}
              placeholder="30000"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-dim text-[12.5px] font-semibold">
            Barrios y precios
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--gold-bright)" }}
            onClick={addZone}
          >
            + Agregar barrio
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {zones.length === 0 ? (
            <div className="text-faint text-[12.5px]">
              Sin barrios. Agregá el primero.
            </div>
          ) : (
            zones.map((z, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={z.name}
                  onChange={(e) => setZone(i, { name: e.target.value })}
                  placeholder="Nombre del barrio"
                />
                <div
                  className="input flex items-center gap-1"
                  style={{ width: 130 }}
                >
                  <span className="text-faint">$</span>
                  <input
                    type="number"
                    value={z.price}
                    onChange={(e) => setZone(i, { price: e.target.value })}
                    style={{
                      border: "none",
                      background: "transparent",
                      outline: "none",
                      width: "100%",
                      color: "var(--fg)",
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-icon btn-ghost"
                  onClick={() => delZone(i)}
                  aria-label="Quitar barrio"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <Button type="button" onClick={submit} loading={busy}>
          Guardar envíos
        </Button>
      </div>

      {/* Columna derecha: mensaje fuera de ciudad + cómo funciona */}
      <div className="flex flex-col gap-4">
        <div className="ui-card section-card flex flex-col gap-3">
          <div className="section-title">
            Mensaje &quot;fuera de {city || "la ciudad"}&quot;
          </div>
          <div className="text-faint -mt-2 text-[12.5px]">
            Lo que ve el cliente al elegir un envío fuera de tu ciudad, en el
            checkout.
          </div>
          <textarea
            className="textarea"
            style={{ minHeight: 90 }}
            value={outMsg}
            onChange={(e) => setOutMsg(e.target.value)}
            placeholder="Coordinamos el envío por WhatsApp; el costo del flete queda a cargo del comprador."
          />
        </div>

        <div className="ui-card section-card flex flex-col gap-2">
          <div
            className="flex items-center gap-2"
            style={{ color: "var(--info, #5A9CD9)" }}
          >
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <b className="text-[13px]">¿Cómo funcionan los envíos?</b>
          </div>
          <div className="text-faint text-[12.5px] leading-relaxed">
            Dentro de <b>{city || "tu ciudad"}</b>: el cliente elige su barrio y
            paga el precio que configures acá.{" "}
            <b>Fuera de {city || "tu ciudad"}</b>: el pedido se coordina por
            chat y el <b>envío corre por cuenta del comprador</b>{" "}
            (encomienda/correo). El retiro en el taller siempre es gratis.
          </div>
        </div>
      </div>
    </div>
  );
}
