"use client";

import { useRouter } from "next/navigation";
import type { EarningsMonth } from "../service";

/**
 * Filtro de mes del panel Ganancias. Navega con ?mes=YYYY-MM (server filtra).
 * Al entrar (sin ?mes) se muestra el mes más nuevo; "all" = todos los meses.
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
        router.push(`/admin/ganancias?mes=${e.target.value}`);
      }}
    >
      <option value="all">Todos los meses</option>
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
