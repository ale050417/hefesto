"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createGuestCustomRequestAction } from "../actions";

function waHref(whatsapp: string | null, text: string): string | null {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

export function GuestRequestForm({ whatsapp }: { whatsapp: string | null }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
    budget: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await createGuestCustomRequestAction(form);
      setBusy(false);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setDone(true);
    } catch {
      setBusy(false);
      setErr("No se pudo enviar. Probá de nuevo.");
    }
  }

  const directWa = waHref(whatsapp, "¡Hola! Quiero un pedido a medida:");

  if (done) {
    const wa = waHref(
      whatsapp,
      `¡Hola! Hice un pedido a medida: ${form.description}`,
    );
    return (
      <div className="ui-card flex flex-col items-center gap-3 p-8 text-center">
        <div
          className="kpi-ic"
          style={{
            background: "rgba(var(--gold-rgb),.14)",
            color: "var(--gold-bright)",
            width: 52,
            height: 52,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-fg font-display text-lg font-bold">
          ¡Recibimos tu pedido!
        </h3>
        <p className="text-dim max-w-sm text-sm">
          Te vamos a contactar. Para ir más rápido, seguí la charla por WhatsApp
          y mandanos una foto de referencia si tenés.
        </p>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            className="btn btn-primary"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.7-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" />
            </svg>
            Seguir por WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ui-card flex flex-col gap-4 p-6">
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="gr-name">Tu nombre</label>
          <input
            id="gr-name"
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="gr-phone">WhatsApp</label>
          <input
            id="gr-phone"
            className="input"
            placeholder="Ej: 11 5512-8834"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="gr-email">
          Email <span className="text-faint font-normal">(opcional)</span>
        </label>
        <input
          id="gr-email"
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="gr-desc">Contanos qué querés</label>
        <textarea
          id="gr-desc"
          rows={4}
          className="textarea"
          placeholder="Ej: una lámpara con la forma de la luna, tamaño mediano, en dorado…"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="gr-budget">
          Presupuesto aproximado{" "}
          <span className="text-faint font-normal">(opcional)</span>
        </label>
        <input
          id="gr-budget"
          type="number"
          className="input"
          placeholder="$"
          value={form.budget}
          onChange={(e) => set("budget", e.target.value)}
        />
      </div>
      <Button type="button" onClick={submit} loading={busy}>
        {busy ? "Enviando…" : "Enviar pedido"}
      </Button>
      {directWa ? (
        <a
          href={directWa}
          target="_blank"
          rel="noreferrer noopener"
          className="text-center text-[12.5px]"
          style={{ color: "var(--gold-bright)" }}
        >
          o escribinos directo por WhatsApp
        </a>
      ) : null}
    </div>
  );
}
