"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BrandMark } from "./brand-mark";
import { ThemeSwitcher } from "./theme-switcher";
import { AdminNotificationBell } from "@/features/notifications/components/admin-notification-bell";
import { AssistantWidget } from "@/features/assistant/components/assistant-widget";

/**
 * Estructura del panel: topbar SIEMPRE visible (2026-07-11) con las acciones
 * globales — volver a la tienda, tema claro/oscuro y la campana de
 * notificaciones (instancia ÚNICA: antes se montaba también en el sidebar y
 * duplicaba fetch/polling) — + sidebar compacto. En móvil el sidebar es un
 * drawer off-canvas con backdrop; se cierra al navegar, al tocar el backdrop
 * o con Escape.
 */
function readNavCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("admin-nav-collapsed") === "1";
  } catch {
    return false;
  }
}

export function AdminShell({
  perms,
  children,
}: {
  perms?: Record<string, boolean>;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Colapsar el sidebar en desktop: el burger lo oculta/muestra para "ver mejor".
  // La preferencia se lee de localStorage en el INICIALIZADOR del useState (un
  // sistema externo), no en un effect: evita el setState-en-effect y renders de más.
  const [collapsed, setCollapsed] = useState(readNavCollapsed);
  // Un solo botón para ambos casos: en desktop (sidebar fijo) alterna colapsado;
  // en móvil abre/cierra el drawer off-canvas.
  const toggleNav = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      setCollapsed((c) => {
        const next = !c;
        try {
          localStorage.setItem("admin-nav-collapsed", next ? "1" : "0");
        } catch {}
        return next;
      });
    } else {
      setMenuOpen((o) => !o);
    }
  };

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
    <div
      suppressHydrationWarning
      className={`admin-shell${collapsed ? "nav-collapsed" : ""}`}
    >
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-burger"
          aria-label="Mostrar u ocultar menú"
          aria-expanded={menuOpen}
          onClick={toggleNav}
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
        {/* Acciones globales: tienda + tema + notificaciones (única campana) */}
        <span className="ml-auto flex items-center gap-2">
          <Link
            href="/"
            className="text-dim hover:text-fg flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors"
            title="Volver a la tienda"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
              aria-hidden
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <span className="hidden sm:inline">Volver a la tienda</span>
          </Link>
          <ThemeSwitcher />
          <AdminNotificationBell />
        </span>
      </header>

      <div className="admin-body">
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

      {/* Asistente IA del negocio (burbuja flotante, solo en el admin) */}
      <AssistantWidget />
    </div>
  );
}
