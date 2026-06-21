"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    router.push(
      value ? `/catalogo?q=${encodeURIComponent(value)}` : "/catalogo",
    );
  }

  return (
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
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar productos, categorías, materiales…"
        aria-label="Buscar productos"
      />
    </form>
  );
}
