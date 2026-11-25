"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/core/supabase/browser";
import { toast } from "@/stores/toastStore";
import {
  getAdminNotificationsAction,
  markAdminNotificationsReadAction,
} from "../actions";
import type { KindPref } from "../kinds";
import { getPushState } from "../push-client";
import type { AdminNotificationView } from "../service";
import { NotificationSettings } from "./notification-settings";

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Campana de notificaciones del ADMIN (pedidos nuevos, stock bajo, mensajes).
 * Mismo lenguaje visual que la del cliente (NotificationBell). Se actualiza en
 * tiempo real: escucha los INSERT de `notifications` por Supabase Realtime y
 * re-consulta; si Realtime no está disponible, cae a polling cada 30 s (solo
 * con la pestaña visible).
 *
 * 2026-11-22 (Agustín: "siempre pasa desapercibido el símbolo"): cada persona
 * ve solo los tipos de aviso de sus módulos y tiene SU contador de no leídos;
 * un aviso nuevo salta además como cartel en pantalla; y desde el engranaje se
 * eligen los tipos y se activan los avisos en el dispositivo (push).
 */
export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [items, setItems] = useState<AdminNotificationView[]>([]);
  const [kinds, setKinds] = useState<KindPref[]>([]);
  const [unread, setUnread] = useState(0);
  // ¿Conviene ofrecer "activar avisos en este dispositivo"?
  const [offerPush, setOfferPush] = useState(false);
  // Último aviso ya conocido: lo que llegue después salta como cartel.
  const lastSeenId = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Canal de realtime ÚNICO por instancia: esta campana se monta 2 veces
  // (topbar móvil + sidebar desktop). Dos canales con el MISMO nombre colisionan
  // ("cannot add postgres_changes callbacks after subscribe()") y ese throw,
  // al ocurrir dentro del effect, escala al error boundary ("Algo salió mal").
  // Un sufijo aleatorio por instancia evita la colisión.
  const [channelName] = useState(
    () => `rt:notifications:admin:${Math.random().toString(36).slice(2, 10)}`,
  );

  const apply = useCallback(
    (r: Awaited<ReturnType<typeof getAdminNotificationsAction>>) => {
      const newest = r.items[0];
      // Llegó algo nuevo con el panel abierto: cartel en pantalla (la campana
      // sola pasaba desapercibida). En la primera carga no se avisa nada.
      if (
        newest &&
        newest.unread &&
        lastSeenId.current !== null &&
        lastSeenId.current !== newest.id
      ) {
        toast(newest.body ? `${newest.title}: ${newest.body}` : newest.title);
      }
      lastSeenId.current = newest?.id ?? "";
      setItems(r.items);
      setKinds(r.kinds);
      setUnread(r.unread);
    },
    [],
  );

  const load = useCallback(async () => {
    apply(await getAdminNotificationsAction());
  }, [apply]);

  useEffect(() => {
    let active = true;
    void getAdminNotificationsAction().then((r) => {
      if (active) apply(r);
    });
    void getPushState().then((s) => {
      if (active) setOfferPush(s === "off");
    });
    return () => {
      active = false;
    };
  }, [apply]);

  // Realtime: INSERT en notifications → re-consulta. Fallback: polling 30 s.
  useEffect(() => {
    const supabase = createClient();
    let subscribed = false;
    let last = 0;
    const refresh = () => {
      const now = Date.now();
      if (now - last < 1_000 || document.hidden) return;
      last = now;
      void load();
    };
    // Realtime es best-effort: si falla al suscribirse NO debe tirar el panel
    // (antes escalaba al error boundary). Cae a polling.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          refresh,
        )
        .subscribe((status) => {
          subscribed = status === "SUBSCRIBED";
        });
    } catch (e) {
      console.warn("[notif-admin] realtime no disponible; uso polling:", e);
    }
    const interval = setInterval(() => {
      if (!subscribed) refresh();
    }, 30_000);
    return () => {
      clearInterval(interval);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, channelName]);

  // Cerrar al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    setSettings(false);
    if (next && unread > 0) {
      // El numerito se va; los puntos de "nuevo" quedan durante esta vista.
      setUnread(0);
      void markAdminNotificationsReadAction();
    }
  }

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn relative"
        onClick={toggle}
        aria-label={`Notificaciones${unread > 0 ? ` (${unread})` : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="18"
          height="18"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="ic-badge">{unread > 9 ? "9+" : unread}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-head">
            <h3>{settings ? "Avisos" : "Notificaciones"}</h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-dim hover:text-fg text-[12.5px] underline-offset-2 hover:underline"
                onClick={() => setSettings((v) => !v)}
              >
                {settings ? "← Volver" : "⚙ Configurar"}
              </button>
              <button
                type="button"
                className="text-dim hover:text-fg text-lg leading-none"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
          </div>

          {!settings && offerPush ? (
            <button
              type="button"
              className="hover:bg-surface-2 flex w-full items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 text-left text-[12.5px]"
              style={{ color: "var(--gold-bright)" }}
              onClick={() => setSettings(true)}
            >
              🔔 Activá los avisos en este dispositivo para no perderte nada →
            </button>
          ) : null}

          {settings ? (
            <NotificationSettings
              kinds={kinds}
              onKindsChange={(next) => {
                setKinds(next);
                void load();
                void getPushState().then((s) => setOfferPush(s === "off"));
              }}
            />
          ) : items.length === 0 ? (
            <div className="notif-empty">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                width="40"
                height="40"
              >
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              <p className="text-sm">Sin novedades. ¡Todo al día!</p>
            </div>
          ) : (
            <div className="notif-list">
              {items.map((n) => {
                const inner = (
                  <>
                    <span
                      className={n.unread ? "notif-dot" : "notif-dot read"}
                      aria-hidden
                    />
                    <span className="notif-body">
                      <b>{n.title}</b>
                      {n.body ? <p>{n.body}</p> : null}
                      <time>{dateFmt.format(new Date(n.createdAt))}</time>
                    </span>
                  </>
                );
                const cls = n.unread ? "notif-item unread" : "notif-item";
                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    className={cls}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className={cls}>
                    {inner}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
