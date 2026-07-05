"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BrandMark } from "./brand-mark";

/**
 * Estructura del panel con navegación móvil real: topbar con hamburguesa +
 * sidebar off-canvas (drawer con backdrop). El drawer se cierra al navegar, al
 * tocar el backdrop o con Escape. En escritorio el sidebar es una columna fija
 * y la topbar/backdrop se ocultan por CSS.
 */
export function AdminShell({
  perms,
  children,
}: {
  perms?: Record<string, boolean>;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  // El menú se cierra al tocar un link (onNavigate en el Sidebar), el backdrop
  // o Escape. Con el drawer abierto: bloquear el scroll del fondo y cerrar con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-burger"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <Link href="/admin" className="brand" aria-label="HEFESTO Admin">
          <BrandMark size={26} />
          <span className="brand-name text-[14px]">
            HEFESTO<b> Admin</b>
          </span>
        </Link>
      </header>

      <Sidebar
        perms={perms}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
      />

      {menuOpen ? (
        <div
          className="sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      ) : null}

      <main id="main" className="admin-content">
        {children}
      </main>
    </div>
  );
}
