"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/features/orders/sale-catalog";
import { formatQuoteMoney } from "@/features/quotes/build-quote";
import type { InquiryProduct, InquiryProductOption } from "../product-prefill";

const MAX_RESULTS = 30;

/**
 * "Cargar desde un producto de la tienda" en la respuesta de una consulta
 * (sugerencia de Agustín, 2026-11-19): se busca el producto, se elige el
 * tamaño si tiene varios y el formulario se rellena solo. Mismo buscador que
 * el de "Cargar venta".
 */
export function ProductPicker({
  products,
  onPick,
}: {
  products: InquiryProduct[];
  onPick: (product: InquiryProduct, option: InquiryProductOption) => void;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<InquiryProduct | null>(null);
  const [optionIndex, setOptionIndex] = useState(0);

  const results = useMemo(() => {
    const needle = normalizeSearch(search);
    if (!needle) return [];
    return products.filter((p) =>
      normalizeSearch(`${p.name} ${p.categoryName ?? ""}`).includes(needle),
    );
  }, [products, search]);

  function choose(product: InquiryProduct, index: number) {
    const option = product.options[index];
    if (!option) return;
    setPicked(product);
    setOptionIndex(index);
    setSearch("");
    onPick(product, option);
  }

  return (
    <div className="field">
      <label htmlFor="ans-product">
        Cargar desde un producto de la tienda (opcional)
      </label>
      <input
        id="ans-product"
        className="input"
        value={search}
        maxLength={80}
        placeholder="Buscar producto…"
        autoComplete="off"
        onChange={(e) => setSearch(e.target.value)}
      />
      {search.trim() ? (
        <div className="max-h-48 overflow-auto rounded-md border border-[var(--border)]">
          {results.length === 0 ? (
            <div className="text-faint p-3 text-[12.5px]">Sin resultados.</div>
          ) : (
            results.slice(0, MAX_RESULTS).map((p) => {
              const prices = p.options.map((o) => o.unitPrice);
              const min = Math.min(...prices);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="hover:bg-surface-2 flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
                  onClick={() => choose(p, 0)}
                >
                  <span className="min-w-0 break-words">
                    {p.name}
                    {p.categoryName ? (
                      <span className="text-faint"> · {p.categoryName}</span>
                    ) : null}
                  </span>
                  <span className="text-dim shrink-0 text-xs">
                    {Math.max(...prices) > min ? "desde " : ""}
                    {formatQuoteMoney(min)}
                  </span>
                </button>
              );
            })
          )}
          {results.length > MAX_RESULTS ? (
            <div className="text-faint p-3 text-[12.5px]">
              Hay más resultados: escribí algo más para afinar.
            </div>
          ) : null}
        </div>
      ) : picked ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-dim text-xs">
            Datos cargados desde <b className="text-fg">{picked.name}</b>. Podés
            cambiar lo que haga falta.
          </p>
          {picked.options.length > 1 ? (
            <select
              className="select"
              style={{ maxWidth: 260 }}
              aria-label="Tamaño del producto"
              value={optionIndex}
              onChange={(e) => choose(picked, Number(e.target.value))}
            >
              {picked.options.map((o, i) => (
                <option key={o.label ?? i} value={i}>
                  {o.label} · {formatQuoteMoney(o.unitPrice)}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : (
        <p className="text-faint text-xs">
          Si ya está cargado en la tienda, buscalo y se rellenan el precio, las
          medidas, la demora y los colores.
        </p>
      )}
    </div>
  );
}
