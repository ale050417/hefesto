"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { savePaymentSettingsAction } from "../actions";
import type { PaymentSettings } from "../types";
import { runAction } from "@/lib/run-action";

const ic = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const I = {
  dollar:
    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4h9l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
};

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
    try {
      const res = await runAction(() => savePaymentSettingsAction(form), {
        silent: true,
      });
      if (!res.ok) return toast(res.error.message, "danger");
      toast("Métodos de pago guardados", "success");
      router.refresh();
    } catch {
      toast("No se pudo guardar. Intentá de nuevo.", "danger");
    } finally {
      setBusy(false);
    }
  }

  const switchBtn = (on: boolean, onToggle: () => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch ${on ? "on" : ""}`}
      onClick={onToggle}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="grid-3">
        {/* Transferencia */}
        <div className="ui-card section-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="kpi-ic">{ic(I.dollar)}</span>
            {switchBtn(
              form.transferEnabled,
              () => set("transferEnabled", !form.transferEnabled),
              "Transferencia",
            )}
          </div>
          <div>
            <div className="text-[15px] font-semibold">
              Transferencia bancaria
            </div>
            <div className="text-faint mt-1 text-[12.5px]">
              CBU / Alias para pagos directos
            </div>
          </div>
          {form.transferEnabled ? (
            <div className="flex flex-col gap-2">
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
                  placeholder="000…"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* MercadoPago */}
        <div className="ui-card section-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="kpi-ic">{ic(I.receipt)}</span>
            {switchBtn(
              form.mpEnabled,
              () => set("mpEnabled", !form.mpEnabled),
              "MercadoPago",
            )}
          </div>
          <div>
            <div className="text-[15px] font-semibold">MercadoPago</div>
            <div className="text-faint mt-1 text-[12.5px]">
              Tarjetas, QR y cuotas. Las credenciales van por variables de
              entorno.
            </div>
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
            <span className="kpi-ic">{ic(I.tag)}</span>
            {switchBtn(
              form.cashEnabled,
              () => set("cashEnabled", !form.cashEnabled),
              "Efectivo",
            )}
          </div>
          <div>
            <div className="text-[15px] font-semibold">Efectivo</div>
            <div className="text-faint mt-1 text-[12.5px]">
              Pago al retirar en el local
            </div>
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
      </div>

      <div>
        <Button type="button" onClick={submit} loading={busy}>
          {ic(I.check)} {busy ? "Guardando…" : "Guardar métodos de pago"}
        </Button>
      </div>
    </div>
  );
}
