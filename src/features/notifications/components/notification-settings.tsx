"use client";

import { useEffect, useState } from "react";
import { toast } from "@/stores/toastStore";
import { saveNotificationPrefsAction } from "../actions";
import type { KindPref } from "../kinds";
import {
  disablePush,
  enablePush,
  getPushState,
  type PushState,
} from "../push-client";

const PUSH_HELP: Record<Exclude<PushState, "on" | "off">, string> = {
  unsupported:
    "Este navegador no puede mostrar avisos. En iPhone: abrí la web en Safari, tocá Compartir → «Agregar a inicio» y entrá desde ese ícono.",
  unconfigured:
    "Los avisos al dispositivo todavía no están configurados en el servidor.",
  denied:
    "Los avisos de este sitio están bloqueados en el navegador. Tocá el candado de la barra de direcciones → Notificaciones → Permitir.",
};

/**
 * "Qué avisos recibir" (sugerencia de Agustín, 2026-11-22): activar los
 * avisos en ESTE dispositivo (llegan aunque el panel esté cerrado) y prender
 * o apagar cada tipo. Los cambios se guardan al tocar.
 */
export function NotificationSettings({
  kinds,
  onKindsChange,
}: {
  kinds: KindPref[];
  onKindsChange: (kinds: KindPref[]) => void;
}) {
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void getPushState().then((s) => {
      if (active) setPush(s);
    });
    return () => {
      active = false;
    };
  }, []);

  async function togglePush() {
    setBusy(true);
    try {
      const next = push === "on" ? await disablePush() : await enablePush();
      setPush(next);
      if (next === "on")
        toast("Avisos activados en este dispositivo", "success");
      else if (next === "denied")
        toast("El navegador bloqueó los avisos.", "danger");
    } catch {
      toast("No se pudieron activar los avisos. Probá de nuevo.", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function toggleKind(key: string, enabled: boolean) {
    const before = kinds;
    const next = kinds.map((k) => (k.key === key ? { ...k, enabled } : k));
    onKindsChange(next); // optimista
    const res = await saveNotificationPrefsAction(
      next.filter((k) => !k.enabled).map((k) => k.key),
    );
    if (res.ok) onKindsChange(res.kinds);
    else {
      onKindsChange(before);
      toast("No se pudo guardar. Probá de nuevo.", "danger");
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2">
        <h4 className="text-[13px] font-semibold">En este dispositivo</h4>
        {push === "on" || push === "off" ? (
          <>
            <p className="text-faint text-[12px] leading-relaxed">
              {push === "on"
                ? "Activados: los avisos te llegan a este celular / compu aunque el panel esté cerrado."
                : "Activalos y los avisos te llegan a este celular / compu aunque el panel esté cerrado. Se activa en cada dispositivo."}
            </p>
            <button
              type="button"
              className={`btn btn-sm self-start ${push === "on" ? "btn-secondary" : "btn-primary"}`}
              onClick={togglePush}
              disabled={busy}
            >
              {busy
                ? "Un momento…"
                : push === "on"
                  ? "Desactivar en este dispositivo"
                  : "Activar avisos en este dispositivo"}
            </button>
          </>
        ) : push ? (
          <p className="text-faint text-[12px] leading-relaxed">
            {PUSH_HELP[push]}
          </p>
        ) : (
          <p className="text-faint text-[12px]">Revisando…</p>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h4 className="text-[13px] font-semibold">Qué avisos recibir</h4>
        {kinds.length === 0 ? (
          <p className="text-faint text-[12px]">No hay avisos para tu rol.</p>
        ) : (
          kinds.map((k) => (
            <label
              key={k.key}
              className="flex cursor-pointer items-start gap-3 border-t border-[var(--border)] py-2.5 first:border-t-0"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]"
                checked={k.enabled}
                onChange={(e) => toggleKind(k.key, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{k.label}</span>
                <span className="text-faint block text-[11.5px] leading-snug">
                  {k.description}
                </span>
              </span>
            </label>
          ))
        )}
      </section>
    </div>
  );
}
