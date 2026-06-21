"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchProductsAction } from "../search-actions";
import type { ProductView } from "../types";

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductView[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Búsqueda en vivo con debounce. setState va en el .then (async), no en el cuerpo.
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(() => {
      if (term.length < 2) {
        setResults([]);
        return;
      }
      searchProductsAction(term).then((items) => setResults(items));
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    setOpen(false);
    router.push(
      value ? `/catalogo?q=${encodeURIComponent(value)}` : "/catalogo",
    );
  }

  const showResults = open && q.trim().length >= 2;

  return (
    <div className="relative" ref={ref}>
      <form onSubmit={submit} className="store-search" role="search">
        <span className="ss-ico" aria-hidden>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="17"
            height="17"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          className="ss-input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar productos, categorías, materiales…"
          aria-label="Buscar productos"
        />
      </form>

      {showResults ? (
        <div className="ss-results">
          {results.length === 0 ? (
            <p className="text-dim px-3 py-4 text-center text-sm">
              Sin resultados para “{q.trim()}”.
            </p>
          ) : (
            <>
              {results.map((p) => (
                <Link
                  key={p.id}
                  href={`/producto/${p.slug}`}
                  className="ss-result"
                  onClick={() => setOpen(false)}
                >
                  <span className={cn("ss-result-img")}>
                    {p.primaryImage ? (
                      <Image
                        src={p.primaryImage.url}
                        alt={p.primaryImage.alt}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : null}
                  </span>
                  <span className="ss-result-txt">
                    <b>{p.name}</b>
                    <span>{formatPrice(p.effectivePrice)}</span>
                  </span>
                </Link>
              ))}
              <button type="button" className="ss-result-all" onClick={submit}>
                Ver todos los resultados
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
