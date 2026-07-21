"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Category } from "../types";

const PRICE_MIN = 3000;
const PRICE_MAX = 50000;

export function FilterPanel({
  categories,
  materials,
}: {
  categories: Category[];
  materials: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k);

  const [maxPrice, setMaxPrice] = useState<number>(
    Number(sp.get("maxPrice")) || PRICE_MAX,
  );
  // En celular los filtros arrancan colapsados (así los productos se ven sin
  // scrollear); en desktop (md+) siempre visibles.
  const [open, setOpen] = useState(false);

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // cualquier cambio vuelve a la página 1
    router.push(`/catalogo?${params.toString()}`);
  }

  const activeCategory = get("category");

  // Jerarquía padre → subcategorías (estándar e-commerce). Elegir un padre ya
  // trae los productos de sus hijas (lo resuelve el repository).
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => !c.parentId || !ids.has(c.parentId));
  const childrenOf = (id: string) =>
    categories.filter((c) => c.parentId === id);

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
          {roots.map((root) => (
            <div key={root.id}>
              <label className="f-radio">
                <input
                  type="radio"
                  name="cat"
                  className="sr-only"
                  checked={activeCategory === root.slug}
                  onChange={() => setParams({ category: root.slug })}
                />
                <span className="rdot" />
                {root.name}
              </label>
              {childrenOf(root.id).map((sub) => (
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
              ))}
            </div>
          ))}
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

        <div className="filter-group">
          <h5>Material</h5>
          <select
            className="select w-full"
            value={get("material") ?? ""}
            onChange={(e) => setParams({ material: e.target.value || null })}
          >
            <option value="">Todos</option>
            {materials.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

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
      </div>
    </div>
  );
}
