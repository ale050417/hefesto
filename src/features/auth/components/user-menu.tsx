"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

type UserMenuProps = {
  name: string;
  email: string | null;
  /** Saldo de puntos. Solo se muestra en el chip para clientes; null para staff. */
  points: number | null;
  isClient: boolean;
  /** Muestra el acceso al panel dentro del menú (staff). */
  isStaff?: boolean;
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

export function UserMenu({
  name,
  email,
  points,
  isClient,
  isStaff = false,
}: UserMenuProps) {
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

            {/* En mobile el switch de tema vive acá (en el header no entra) */}
            <div className="user-menu-theme">
              <span className="text-dim text-[12px]">Tema</span>
              <ThemeSwitcher />
            </div>

            <div className="user-menu-items">
              {isStaff ? (
                <Link
                  href="/admin"
                  className="dropdown-item"
                  onClick={close}
                  role="menuitem"
                  style={{ color: "var(--gold-bright)" }}
                >
                  <svg {...svgProps}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  Panel de gestión
                </Link>
              ) : null}
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
              {/* Pedidos y puntos NO van acá: viven dentro de Mi cuenta, que ya
                  los muestra con su sidebar. Un desplegable con tres accesos
                  al mismo lugar es ruido (pedido de Ale, 2026-08-04). */}
            </div>

            <div className="user-menu-sep" aria-hidden="true" />

            <LogoutButton className="dropdown-item danger">
              <svg {...svgProps}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
              Cerrar sesión
            </LogoutButton>
          </div>
        ) : null}
      </div>
    </>
  );
}
