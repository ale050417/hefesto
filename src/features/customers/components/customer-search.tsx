"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function CustomerSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  function onChange(v: string) {
    setValue(v);
    const next = new URLSearchParams(params.toString());
    if (v) next.set("q", v);
    else next.delete("q");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  // Búsqueda fluida en móvil: el ancho fijo pasa a ser tope máximo.
  return (
    <div className="search" style={{ width: "100%", maxWidth: 300 }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        className="input"
        placeholder="Buscar por nombre o email..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
