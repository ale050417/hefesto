"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";
import { buildWhatsappUrl } from "@/lib/site";
import { buildFilamentReport } from "../report";
import type { FilamentView } from "../types";

/**
 * Botón "Informe" de la pantalla de filamentos (pedido de Ale, 2026-10-30):
 * arma el informe de stock en texto, lo deja retocar y lo copia o lo manda por
 * WhatsApp. Mismo criterio que la cotización: sin número, WhatsApp abre para
 * que elijas el chat.
 */
export function FilamentReportButton({
  filaments,
}: {
  filaments: FilamentView[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
        title="Informe de stock para copiar o mandar por WhatsApp"
      >
        Informe
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Informe de filamentos"
        size="lg"
      >
        <FilamentReportForm filaments={filaments} />
      </Modal>
    </>
  );
}

// El Modal desmonta su contenido al cerrarse: el informe se arma de nuevo
// (con el stock y la fecha del momento) en cada apertura.
function FilamentReportForm({ filaments }: { filaments: FilamentView[] }) {
  const [text, setText] = useState(() =>
    buildFilamentReport(filaments, new Date()),
  );
  const [to, setTo] = useState("");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Informe copiado", "success");
    } catch {
      toast("No se pudo copiar; seleccioná el texto y copialo.", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="field">
        <label htmlFor="fr-text">Texto del informe (podés retocarlo)</label>
        <textarea
          id="fr-text"
          className="textarea font-mono text-[12.5px]"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="fr-to">WhatsApp de destino (opcional)</label>
        <input
          id="fr-to"
          className="input"
          inputMode="tel"
          placeholder="Ej: 3757 123456"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={copy}>
          {copied ? "Copiado ✓" : "Copiar informe"}
        </button>
        <a
          className="btn btn-secondary"
          href={buildWhatsappUrl(to.trim() || null, text)}
          target="_blank"
          rel="noreferrer"
        >
          Enviar por WhatsApp
        </a>
      </div>
      <div className="text-faint text-[11.5px] leading-snug">
        Sin número, WhatsApp abre para que elijas el chat.
      </div>
    </div>
  );
}
