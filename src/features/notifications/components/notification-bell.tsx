"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  getMyNotificationsAction,
  markNotificationsReadAction,
} from "../actions";
import type { Notification } from "../repository";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Carga inicial (setState en la continuación async, no en el cuerpo del efecto).
  useEffect(() => {
    let active = true;
    getMyNotificationsAction().then((r) => {
      if (!active) return;
      setItems(r.items);
      setUnread(r.unread);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      void markNotificationsReadAction();
    }
  }

  return (
    <div className={cn("dropdown", open && "open")} ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={`Notificaciones${unread > 0 ? ` (${unread})` : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="17"
          height="17"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="ic-badge">{unread}</span> : null}
      </button>
      <div className="dropdown-menu notif-menu">
        <div className="notif-head">Notificaciones</div>
        <div className="notif-list">
          {items.length === 0 ? (
            <p className="text-dim px-3 py-6 text-center text-sm">
              No tenés notificaciones.
            </p>
          ) : (
            items.map((n) => {
              const inner = (
                <>
                  <b>{n.title}</b>
                  {n.body ? <span>{n.body}</span> : null}
                </>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  className="notif-item"
                  onClick={() => setOpen(false)}
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="notif-item">
                  {inner}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
