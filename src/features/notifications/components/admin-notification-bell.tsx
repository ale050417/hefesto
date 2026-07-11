"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/core/supabase/browser";
import {
  getAdminNotificationsAction,
  markAdminNotificationsReadAction,
} from "../actions";
import type { Notification } from "../repository";

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
 * con la pestaña visible). Broadcast: lo ve todo el staff.
 */
export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Canal de realtime ÚNICO por instancia: esta campana se monta 2 veces
  // (topbar móvil + sidebar desktop). Dos canales con el MISMO nombre colisionan
  // ("cannot add postgres_changes callbacks after subscribe()") y ese throw,
  // al ocurrir dentro del effect, escala al error boundary ("Algo salió mal").
  // Un sufijo aleatorio por instancia evita la colisión.
  const [channelName] = useState(
    () => `rt:notifications:admin:${Math.random().toString(36).slice(2, 10)}`,
  );

  const load = useCallback(async () => {
    const r = await getAdminNotificationsAction();
    setItems(r.items);
    setUnread(r.unread);
  }, []);

  useEffect(() => {
    let active = true;
    void getAdminNotificationsAction().then((r) => {
      if (!active) return;
      setItems(r.items);
      setUnread(r.unread);
    });
    return () => {
      active = false;
    };
  }, []);

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
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
            <h3>Notificaciones</h3>
            <button
              type="button"
              className="text-dim hover:text-fg text-lg leading-none"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {items.length === 0 ? (
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
                      className={n.isRead ? "notif-dot read" : "notif-dot"}
                      aria-hidden
                    />
                    <span className="notif-body">
                      <b>{n.title}</b>
                      {n.body ? <p>{n.body}</p> : null}
                      <time>{dateFmt.format(new Date(n.createdAt))}</time>
                    </span>
                  </>
                );
                const cls = n.isRead ? "notif-item" : "notif-item unread";
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
