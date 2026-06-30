"use client";

import { useRouter } from "next/navigation";
import type { EarningsMonth } from "../service";

/**
 * Filtro de mes del panel Ganancias. Navega con ?mes=YYYY-MM (server filtra).
 * "" = todos los meses.
 */
export function EarningsMonthFilter({
  months,
  selected,
}: {
  months: EarningsMonth[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <select
      className="select"
      style={{ width: "auto" }}
      value={selected}
      aria-label="Filtrar por mes"
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/admin/ganancias?mes=${v}` : "/admin/ganancias");
      }}
    >
      <option value="">Todos los meses</option>
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
