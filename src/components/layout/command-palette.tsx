"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "./sidebar";

/**
 * Buscador global del panel (Ctrl+K / ⌘K, 2026-10-21): saltar a cualquier
 * sección, a una acción (nuevo producto, cargar venta…) o a un producto o
 * cliente por nombre, desde cualquier pantalla y sin el mouse.
 *
 * Las páginas y acciones se filtran acá mismo; productos y clientes se
 * piden a /api/admin/search a partir de 2 letras (con debounce).
 */

export const PALETTE_EVENT = "hef:palette";
export function openPalette() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(PALETTE_EVENT));
}

type Item = {
  key: string;
  group: "Páginas" | "Acciones" | "Productos" | "Clientes";
  label: string;
  hint?: string;
  href: string;
  image?: string | null;
  module?: string;
};

const ACTIONS: Item[] = [
  {
    key: "a:producto",
    group: "Acciones",
    label: "Nuevo producto",
    hint: "Alta paso a paso con foto con IA",
    href: "/admin/productos/nuevo",
    module: "productos",
  },
  {
    key: "a:venta",
    group: "Acciones",
    label: "Cargar venta manual",
    hint: "En Pedidos",
    href: "/admin/pedidos",
    module: "pedidos",
  },
  {
    key: "a:falla",
    group: "Acciones",
    label: "Registrar impresión fallida",
    hint: "Descuenta el filamento perdido",
    href: "/admin/fallas",
    module: "fallas",
  },
  {
    key: "a:filamento",
    group: "Acciones",
    label: "Nuevo filamento",
    hint: "Inventario",
    href: "/admin/filamentos",
    module: "filamentos",
  },
  {
    key: "a:categoria",
    group: "Acciones",
    label: "Nueva categoría",
    href: "/admin/categorias",
    module: "productos",
  },
  {
    key: "a:tienda",
    group: "Acciones",
    label: "Ver la tienda",
    hint: "Abre el sitio público",
    href: "/",
  },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function CommandPalette({ perms }: { perms?: Record<string, boolean> }) {
  const router = useRouter();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Abrir: Ctrl+K / ⌘K o el evento que disparan los botones "Buscar".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Productos y clientes: a partir de 2 letras, con debounce.
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(term)}`,
        );
        const data = (await res.json()) as {
          products?: Array<{
            id: string;
            name: string;
            hint: string;
            image: string | null;
            href: string;
          }>;
          customers?: Array<{
            id: string;
            name: string;
            hint: string;
            href: string;
          }>;
        };
        if (!alive) return;
        setCursor(0);
        setRemote([
          ...(data.products ?? []).map<Item>((p) => ({
            key: `p:${p.id}`,
            group: "Productos",
            label: p.name,
            hint: p.hint,
            href: p.href,
            image: p.image,
          })),
          ...(data.customers ?? []).map<Item>((c) => ({
            key: `c:${c.id}`,
            group: "Clientes",
            label: c.name,
            hint: c.hint,
            href: c.href,
          })),
        ]);
      } catch {
        if (alive) setRemote([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const allowed = (m?: string) => !m || perms?.[m] !== false;
    const pages: Item[] = NAV_LINKS.filter((l) => allowed(l.module)).map(
      (l) => ({
        key: `n:${l.href}`,
        group: "Páginas",
        label: l.label,
        hint: l.group,
        href: l.href,
      }),
    );
    const actions = ACTIONS.filter((a) => allowed(a.module));
    const term = norm(q.trim());
    const local = [...actions, ...pages].filter(
      (i) => !term || norm(`${i.label} ${i.hint ?? ""}`).includes(term),
    );
    // Sin texto: acciones primero (lo que más se usa), después las páginas.
    return [...local, ...(term.length >= 2 ? remote : [])];
  }, [q, remote, perms]);

  function go(item: Item) {
    setOpen(false);
    setQ("");
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(items.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[cursor];
      if (it) go(it);
    }
  }

  // Mantener visible la fila elegida con el teclado.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${cursor}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open || !mounted) return null;

  const groups = ["Acciones", "Páginas", "Productos", "Clientes"] as const;
  let idx = -1;

  return createPortal(
    <div
      className="palette-backdrop"
      data-portal=""
      role="dialog"
      aria-modal="true"
      aria-label="Buscar en el panel"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="palette">
        <div className="palette-input">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            width="18"
            height="18"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              const v = e.target.value;
              setQ(v);
              setCursor(0);
              // Menos de 2 letras: no se busca en la base, se limpia lo remoto.
              if (v.trim().length < 2) {
                setRemote([]);
                setLoading(false);
              }
            }}
            onKeyDown={onKeyDown}
            placeholder="Buscar producto, cliente, sección o acción…"
            aria-label="Buscar"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? <span className="palette-spin" aria-hidden /> : null}
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 ? (
            <div className="palette-empty">
              {loading
                ? "Buscando…"
                : q.trim().length >= 2
                  ? "Nada con ese nombre."
                  : "Escribí para buscar."}
            </div>
          ) : (
            groups.map((g) => {
              const rows = items.filter((i) => i.group === g);
              if (rows.length === 0) return null;
              return (
                <div key={g} className="palette-group">
                  <div className="palette-group-label">{g}</div>
                  {rows.map((it) => {
                    idx += 1;
                    const i = idx;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        data-idx={i}
                        className={cn("palette-row", i === cursor && "active")}
                        onMouseEnter={() => setCursor(i)}
                        onClick={() => go(it)}
                      >
                        {it.image ? (
                          <Image
                            src={it.image}
                            alt=""
                            width={28}
                            height={28}
                            className="palette-thumb"
                          />
                        ) : (
                          <span className="palette-dot" aria-hidden>
                            {g === "Acciones"
                              ? "+"
                              : g === "Clientes"
                                ? "@"
                                : "›"}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="palette-label">{it.label}</span>
                          {it.hint ? (
                            <span className="palette-hint">{it.hint}</span>
                          ) : null}
                        </span>
                        {i === cursor ? <kbd>↵</kbd> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>↵</kbd> abrir
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>K</kbd> abrir o cerrar
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
