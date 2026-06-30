"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/features/auth/actions";

type UserMenuProps = {
  name: string;
  email: string | null;
  /** Saldo de puntos. Solo se muestra en el chip para clientes; null para staff. */
  points: number | null;
  isClient: boolean;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  width: 16,
  height: 16,
  "aria-hidden": true,
} as const;

function Chevron() {
  return (
    <svg
      className="user-chip-caret-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function UserMenu({ name, email, points, isClient }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const firstName = name.split(" ")[0] || name;
  const initial = (name.trim()[0] || "?").toUpperCase();

  // Cerrar al hacer clic afuera o con Escape (igual que el panel de notificaciones).
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

  const close = () => setOpen(false);

  return (
    <>
      <span className="hdr-divider" aria-hidden="true" />
      <div className={cn("dropdown user-menu", open && "open")} ref={wrapRef}>
        <button
          type="button"
          className="user-chip"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="avatar">{initial}</span>
          <span className="user-chip-info">
            <span className="user-chip-name">{firstName}</span>
            {isClient && points != null ? (
              <span className="user-chip-sub">{points} pts</span>
            ) : null}
          </span>
          <span className="user-chip-caret">
            <Chevron />
          </span>
        </button>

        {open ? (
          <div className="dropdown-menu user-menu-panel" role="menu">
            <div className="user-menu-head">
              <span className="avatar user-menu-avatar">{initial}</span>
              <div className="user-menu-id">
                <div className="user-menu-name">{name}</div>
                {email ? <div className="user-menu-email">{email}</div> : null}
              </div>
            </div>

            <div className="user-menu-items">
              <Link
                href="/cuenta"
                className="dropdown-item"
                onClick={close}
                role="menuitem"
              >
                <svg {...svgProps}>
                  <path d="M20 21a8 8 0 1 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Mi cuenta
              </Link>

              <Link
                href="/cuenta/pedidos"
                className="dropdown-item"
                onClick={close}
                role="menuitem"
              >
                <svg {...svgProps}>
                  <path d="m7.5 4.27 9 5.15M21 8.5v7l-9 5-9-5v-7l9-5z" />
                  <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
                </svg>
                Mis pedidos
              </Link>

              <Link
                href="/cuenta/puntos"
                className="dropdown-item"
                onClick={close}
                role="menuitem"
              >
                <svg {...svgProps}>
                  <path d="m12 3 1.9 4.3 4.6.4-3.5 3 1.1 4.5L12 16.9 7.8 19.2l1.1-4.5-3.5-3 4.6-.4z" />
                </svg>
                Mis puntos
                {points != null ? (
                  <span className="user-menu-pts">{points}</span>
                ) : null}
              </Link>
            </div>

            <div className="user-menu-sep" aria-hidden="true" />

            <form action={logoutAction}>
              <button
                type="submit"
                className="dropdown-item danger"
                role="menuitem"
              >
                <svg {...svgProps}>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
                Cerrar sesión
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </>
  );
}
