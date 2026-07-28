"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Category } from "../types";

const PRICE_MIN = 3000;
const PRICE_MAX = 50000;

/**
 * Filtros del catálogo (rediseño 2026-07-24, pedido de Ale):
 * - Destacados / Ofertas ARRIBA de todo (lo más usado).
 * - Sin filtro de Material (alargaba el panel y no aportaba).
 * - Categorías como ÁRBOL desplegable: las subcategorías aparecen recién al
 *   tocar la flecha del padre (elegir el padre ya filtra sus hijas igual).
 */
export function FilterPanel({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k);

  const [maxPrice, setMaxPrice] = useState<number>(
    Number(sp.get("maxPrice")) || PRICE_MAX,
  );
  // En celular los filtros arrancan colapsados (así los productos se ven sin
  // scrollear); en desktop (md+) siempre visibles.
  const [open, setOpen] = useState(false);

  const activeCategory = get("category");

  // Jerarquía padre → subcategorías (estándar e-commerce). Elegir un padre ya
  // trae los productos de sus hijas (lo resuelve el repository).
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId));
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id);

  // Árbol desplegable: si la categoría activa es una hija, su padre arranca
  // abierto (al recargar no se pierde el contexto).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const act = sp.get("category");
    if (act) {
      const cat = categories.find((c) => c.slug === act);
      if (cat?.parentId) s.add(cat.parentId);
      else if (cat) s.add(cat.id);
    }
    return s;
  });
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // cualquier cambio vuelve a la página 1
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <div className="ui-card filter-panel p-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 md:pointer-events-none"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <b className="text-fg text-sm">Filtros</b>
          <svg
            className={`h-4 w-4 transition-transform md:hidden ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="text-xs"
          style={{ color: "var(--gold-bright)" }}
          onClick={() => router.push("/catalogo")}
        >
          Limpiar
        </button>
      </div>
      <div className={`${open ? "block" : "hidden"} mt-1 md:block`}>
        {/* Lo más usado, arriba de todo. */}
        <div className="filter-group">
          <h5>Destacados</h5>
          <label className="f-switch">
            Solo novedades
            <input
              type="checkbox"
              className="accent-[var(--gold)]"
              checked={get("isNew") === "true"}
              onChange={(e) =>
                setParams({ isNew: e.target.checked ? "true" : null })
              }
            />
          </label>
          <label className="f-switch">
            Solo ofertas
            <input
              type="checkbox"
              className="accent-[var(--gold)]"
              checked={get("onSale") === "true"}
              onChange={(e) =>
                setParams({ onSale: e.target.checked ? "true" : null })
              }
            />
          </label>
        </div>

        <div className="filter-group">
          <h5>Categoría</h5>
          <label className="f-radio">
            <input
              type="radio"
              name="cat"
              className="sr-only"
              checked={!activeCategory}
              onChange={() => setParams({ category: null })}
            />
            <span className="rdot" />
            Todas
          </label>
          {roots.map((root) => {
            const subs = childrenOf(root.id);
            const isOpen = expanded.has(root.id);
            return (
              <div key={root.id}>
                <div className="flex items-center gap-1">
                  <label className="f-radio min-w-0 flex-1">
                    <input
                      type="radio"
                      name="cat"
                      className="sr-only"
                      checked={activeCategory === root.slug}
                      // Tocar el NOMBRE filtra la categoría completa (padre +
                      // hijas); desplegar es SOLO con la flecha (pedido de Ale).
                      onChange={() => setParams({ category: root.slug })}
                    />
                    <span className="rdot" />
                    <span className="truncate">{root.name}</span>
                  </label>
                  {subs.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(root.id)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? "Ocultar" : "Ver"} subcategorías de ${root.name}`}
                      className="text-faint hover:text-fg shrink-0 p-1.5"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                {isOpen
                  ? subs.map((sub) => (
                      <label
                        key={sub.id}
                        className="f-radio"
                        style={{ paddingLeft: 22 }}
                      >
                        <input
                          type="radio"
                          name="cat"
                          className="sr-only"
                          checked={activeCategory === sub.slug}
                          onChange={() => setParams({ category: sub.slug })}
                        />
                        <span className="rdot" />
                        {sub.name}
                      </label>
                    ))
                  : null}
              </div>
            );
          })}
        </div>

        <div className="filter-group">
          <h5>Precio máximo</h5>
          <input
            type="range"
            className="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={1000}
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            onPointerUp={() =>
              setParams({
                maxPrice: maxPrice >= PRICE_MAX ? null : String(maxPrice),
              })
            }
            onKeyUp={() =>
              setParams({
                maxPrice: maxPrice >= PRICE_MAX ? null : String(maxPrice),
              })
            }
          />
          <div className="text-faint mt-1.5 flex justify-between text-xs">
            <span>{formatPrice(PRICE_MIN)}</span>
            <b style={{ color: "var(--gold-bright)" }}>
              {formatPrice(maxPrice)}
            </b>
          </div>
        </div>
      </div>
    </div>
  );
}
