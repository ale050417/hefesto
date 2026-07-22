"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { Modal } from "@/components/ui/modal";
import {
  disconnectMpAction,
  saveMpTokenAction,
  savePaymentSettingsAction,
} from "../actions";
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
  mpConnected,
}: {
  settings: PaymentSettings | null;
  mpConnected: boolean;
}) {
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

  // Conexión de MercadoPago (token). El token NUNCA llega acá (solo el estado).
  const [connected, setConnected] = useState(mpConnected);
  const [mpToken, setMpToken] = useState("");
  const [mpBusy, setMpBusy] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  async function saveMpToken() {
    if (mpToken.trim().length < 10) {
      toast("Pegá tu Access Token completo.", "danger");
      return;
    }
    setMpBusy(true);
    const res = await runAction(() => saveMpTokenAction({ token: mpToken }), {
      silent: true,
    });
    setMpBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setConnected(true);
    setMpToken("");
    toast("MercadoPago conectado", "success");
  }

  async function disconnectMp() {
    setMpBusy(true);
    const res = await runAction(() => disconnectMpAction(), { silent: true });
    setMpBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    setConnected(false);
    toast("MercadoPago desconectado", "success");
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await runAction(() => savePaymentSettingsAction(form), {
        silent: true,
      });
      if (!res.ok) return toast(res.error.message, "danger");
      toast("Métodos de pago guardados", "success");
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
      {/* Tarjetas ricas (con campos): 1 columna en tablet para que respiren;
          3 columnas recién en desktop ancho. Evita el look "aplastado". */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-semibold">MercadoPago</div>
              {connected ? (
                <span className="badge badge-success">Conectado</span>
              ) : (
                <span className="text-faint text-[11.5px] font-semibold">
                  Sin conectar
                </span>
              )}
            </div>
            <div className="text-faint mt-1 text-[12.5px]">
              Tarjetas, QR y cuotas. Conectá tu cuenta pegando tu Access Token.
            </div>
          </div>
          {form.mpEnabled ? (
            <div className="flex flex-col gap-2">
              {connected ? (
                <>
                  <div className="text-faint text-[12.5px]">
                    Tu cuenta está conectada. Podés reemplazar el token pegando
                    uno nuevo, o desconectarla.
                  </div>
                  <input
                    className="input"
                    type="password"
                    value={mpToken}
                    autoComplete="off"
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder="Pegar un token nuevo (opcional)"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={saveMpToken}
                      loading={mpBusy}
                    >
                      Reemplazar token
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={disconnectMp}
                      disabled={mpBusy}
                    >
                      Desconectar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Access Token de MercadoPago</label>
                    <input
                      className="input"
                      type="password"
                      value={mpToken}
                      autoComplete="off"
                      onChange={(e) => setMpToken(e.target.value)}
                      placeholder="APP_USR-..."
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      onClick={saveMpToken}
                      loading={mpBusy}
                    >
                      Conectar
                    </Button>
                    <button
                      type="button"
                      className="text-[12.5px] font-semibold"
                      style={{ color: "var(--gold-bright)" }}
                      onClick={() => setHowOpen(true)}
                    >
                      ¿De dónde saco mi token?
                    </button>
                  </div>
                </>
              )}
              <div className="field">
                <label>Nota interna (opcional)</label>
                <input
                  className="input"
                  value={form.mpNote}
                  onChange={(e) => set("mpNote", e.target.value)}
                  placeholder="Ej: comisión 4,9%"
                />
              </div>
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
          {ic(I.check)} Guardar métodos de pago
        </Button>
      </div>

      <Modal
        open={howOpen}
        onClose={() => setHowOpen(false)}
        title="Conectar MercadoPago"
      >
        <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed">
          <p>
            Necesitás tu <b>Access Token de producción</b>. Lo conseguís así:
          </p>
          <ol
            className="flex flex-col gap-2"
            style={{ listStyle: "decimal", paddingLeft: 18 }}
          >
            <li>
              Entrá a <b>mercadopago.com.ar/developers</b> con tu cuenta y andá
              a <b>Tus integraciones</b>.
            </li>
            <li>
              Creá una aplicación (o usá una existente) del tipo{" "}
              <b>Pagos online</b> / Checkout Pro.
            </li>
            <li>
              En <b>Credenciales de producción</b> copiá el <b>Access Token</b>{" "}
              (empieza con <code>APP_USR-</code>).
            </li>
            <li>
              Pegalo acá y tocá <b>Conectar</b>. Los pagos van a tu cuenta.
            </li>
          </ol>
          <p className="text-faint">
            El token es secreto: no lo compartas. Podés cambiarlo o
            desconectarlo cuando quieras.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setHowOpen(false)}>
              Entendido
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
