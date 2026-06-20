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

  return (
    <div className="ui-card filter-panel p-5">
      <div className="mb-1 flex items-center justify-between">
        <b className="text-fg text-sm">Filtros</b>
        <button
          type="button"
          className="text-xs"
          style={{ color: "var(--gold-bright)" }}
          onClick={() => router.push("/catalogo")}
        >
          Limpiar
        </button>
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
        {categories.map((c) => (
          <label key={c.id} className="f-radio">
            <input
              type="radio"
              name="cat"
              className="sr-only"
              checked={activeCategory === c.slug}
              onChange={() => setParams({ category: c.slug })}
            />
            <span className="rdot" />
            {c.name}
          </label>
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
          <b style={{ color: "var(--gold-bright)" }}>{formatPrice(maxPrice)}</b>
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
  );
}
