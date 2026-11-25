"use client";

import { useMemo } from "react";
import { filamentTag } from "@/features/inventory/filament-label";
import { formatPrice } from "@/lib/format";
import { filamentChoices } from "../filament-choices";
import type { FilamentOption } from "../service";

/**
 * Selector "Filamento" de la calculadora. Por defecto agrupa por TIPO
 * (sugerencia de Agustín, 2026-11-24): "PLA — $26.000/kg" en vez de los 50
 * carretes con el precio repetido. Los carretes sin tipo aparecen abajo, de a
 * uno. Con `byType={false}` lista cada carrete (la venta manual necesita saber
 * de cuál se descuenta).
 */
export function FilamentSelect({
  id,
  filaments,
  value,
  onChange,
  byType = true,
}: {
  id: string;
  filaments: FilamentOption[];
  value: string;
  onChange: (filamentId: string) => void;
  byType?: boolean;
}) {
  const { types, loose } = useMemo(
    () => filamentChoices(filaments),
    [filaments],
  );
  const spoolLabel = (f: FilamentOption) =>
    `${filamentTag(f)} — ${formatPrice(f.costPerKg)}/kg`;

  if (!byType || types.length === 0) {
    return (
      <select
        id={id}
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {filaments.map((f) => (
          <option key={f.id} value={f.id}>
            {spoolLabel(f)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <select
      id={id}
      className="select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {types.map((t) => (
        <option key={t.typeId} value={t.value}>
          {t.name} — {formatPrice(t.costPerKg)}/kg
        </option>
      ))}
      {loose.length > 0 ? (
        <optgroup label="Carretes sin tipo (precio propio)">
          {loose.map((f) => (
            <option key={f.id} value={f.id}>
              {spoolLabel(f)}
            </option>
          ))}
        </optgroup>
      ) : null}
    </select>
  );
}
