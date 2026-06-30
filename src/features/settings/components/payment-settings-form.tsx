"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { savePaymentSettingsAction } from "../actions";
import type { PaymentSettings } from "../types";

export function PaymentSettingsForm({
  settings,
}: {
  settings: PaymentSettings | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    transferEnabled: settings?.transferEnabled ?? true,
    transferAlias: settings?.transferAlias ?? "",
    transferCbu: settings?.transferCbu ?? "",
    mpEnabled: settings?.mpEnabled ?? true,
    mpNote: settings?.mpNote ?? "",
    cashEnabled: settings?.cashEnabled ?? true,
    cashNote: settings?.cashNote ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setBusy(true);
    const res = await savePaymentSettingsAction(form);
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Métodos de pago guardados", "success");
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {/* Transferencia */}
      <div className="ui-card section-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-title">Transferencia bancaria</div>
            <div className="text-faint mt-0.5 text-[12.5px]">
              CBU / Alias para pagos directos.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.transferEnabled}
            aria-label="Transferencia"
            className={`switch${form.transferEnabled ? "on" : ""}`}
            onClick={() => set("transferEnabled", !form.transferEnabled)}
          />
        </div>
        {form.transferEnabled ? (
          <div className="grid-2">
            <div className="field">
              <label>Alias</label>
              <input
                className="input"
                value={form.transferAlias}
                onChange={(e) => set("transferAlias", e.target.value)}
                placeholder="hefesto.3d.mp"
              />
            </div>
            <div className="field">
              <label>CBU</label>
              <input
                className="input"
                value={form.transferCbu}
                onChange={(e) => set("transferCbu", e.target.value)}
                placeholder="000..."
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* MercadoPago */}
      <div className="ui-card section-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-title">MercadoPago</div>
            <div className="text-faint mt-0.5 text-[12.5px]">
              Tarjetas, QR y cuotas. Las credenciales se configuran por
              variables de entorno.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.mpEnabled}
            aria-label="MercadoPago"
            className={`switch${form.mpEnabled ? "on" : ""}`}
            onClick={() => set("mpEnabled", !form.mpEnabled)}
          />
        </div>
        {form.mpEnabled ? (
          <div className="field">
            <label>Nota interna</label>
            <input
              className="input"
              value={form.mpNote}
              onChange={(e) => set("mpNote", e.target.value)}
              placeholder="Conectado · comisión 4,9%"
            />
          </div>
        ) : null}
      </div>

      {/* Efectivo */}
      <div className="ui-card section-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-title">Efectivo</div>
            <div className="text-faint mt-0.5 text-[12.5px]">
              Pago al retirar en el local.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.cashEnabled}
            aria-label="Efectivo"
            className={`switch${form.cashEnabled ? "on" : ""}`}
            onClick={() => set("cashEnabled", !form.cashEnabled)}
          />
        </div>
        {form.cashEnabled ? (
          <div className="field">
            <label>Nota</label>
            <input
              className="input"
              value={form.cashNote}
              onChange={(e) => set("cashNote", e.target.value)}
              placeholder="Solo retiro en taller"
            />
          </div>
        ) : null}
      </div>

      <div>
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : "Guardar métodos de pago"}
        </Button>
      </div>
    </div>
  );
}
