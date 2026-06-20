"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PRODUCT_SORTS } from "../schemas";

const sortLabels: Record<(typeof PRODUCT_SORTS)[number], string> = {
  newest: "Más nuevos",
  price_asc: "Precio: menor a mayor",
  price_desc: "Precio: mayor a menor",
  name: "Nombre (A-Z)",
};

export function SortSelect({ sort }: { sort: string }) {
  const router = useRouter();
  const sp = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("sort", value);
    params.delete("page");
    router.push(`/catalogo?${params.toString()}`);
  }

  return (
    <select
      className="select w-auto"
      value={sort}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Ordenar por"
    >
      {PRODUCT_SORTS.map((s) => (
        <option key={s} value={s}>
          {sortLabels[s]}
        </option>
      ))}
    </select>
  );
}
