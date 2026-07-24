"use client";

import { useState, type ReactNode } from "react";

/**
 * Sección colapsable del modal de edición de producto (2026-07: el form era
 * un scroll interminable y se veía sucio). Cerrada muestra solo el título y
 * una pista de lo que contiene; abierta, el contenido completo.
 *
 * El contenido NUNCA se desmonta (se oculta con CSS): los inputs de
 * react-hook-form y los estados locales conservan sus valores aunque la
 * sección esté cerrada.
 *
 * Puede usarse controlada (props `open` + `onToggle`, como hace el form para
 * abrir todo cuando hay errores) o suelta (solo `defaultOpen`).
 */
export function EditSection({
  title,
  hint,
  open: openProp,
  onToggle,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  open?: boolean;
  onToggle?: () => void;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const toggle = onToggle ?? (() => setOwn((o) => !o));
  return (
    <section
      className="rounded-xl border"
      style={{
        borderColor: open ? "var(--border-strong)" : "var(--border)",
        background: open ? "transparent" : "var(--surface-1, transparent)",
      }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <svg
          viewBox="0 0 24 24"
          width={15}
          height={15}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            flexShrink: 0,
            opacity: 0.6,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="min-w-0 flex-1">
          <b className="text-fg block text-[13.5px]">{title}</b>
          {hint ? (
            <span className="text-faint block truncate text-[11.5px]">
              {hint}
            </span>
          ) : null}
        </span>
        <span
          className="shrink-0 text-[11.5px]"
          style={{ color: open ? "var(--gold-bright)" : "var(--text-faint)" }}
        >
          {open ? "Cerrar" : "Editar"}
        </span>
      </button>
      {/* Oculto por CSS, no desmontado: RHF y estados locales no pierden nada. */}
      <div className={open ? "flex flex-col gap-4 px-4 pb-4" : "hidden"}>
        {children}
      </div>
    </section>
  );
}
