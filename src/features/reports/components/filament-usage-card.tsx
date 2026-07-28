"use client";

import { useState } from "react";

export type FilamentUsageRow = {
  material: string;
  color: string;
  hex: string | null;
  grams: number;
};

const fmtG = (g: number) =>
  g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;

/**
 * Tarjeta COMPACTA del panel (2026-07-24, 2ª versión pedida por Ale): mismo
 * tamaño que "Alertas de stock", solo los filamentos CON uso en el mes (sin
 * uso no aparece) y filtro para ordenar por más o menos usados. Barra con el
 * color real e intensidad proporcional al más usado.
 */
export function FilamentUsageCard({
  rows,
  monthName,
}: {
  rows: FilamentUsageRow[];
  monthName: string;
}) {
  const [order, setOrder] = useState<"top" | "bottom">("top");
  const used = rows.filter((r) => r.grams > 0);
  const max = Math.max(1, ...used.map((u) => u.grams));
  const total = used.reduce((a, u) => a + u.grams, 0);
  const sorted = [...used].sort((a, b) =>
    order === "top" ? b.grams - a.grams : a.grams - b.grams,
  );

  return (
    <div className="ui-card section-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="section-title">Filamentos del mes · {monthName}</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            className={`chip ${order === "top" ? "active" : ""}`}
            style={{ fontSize: 11.5 }}
            onClick={() => setOrder("top")}
          >
            Más usados
          </button>
          <button
            type="button"
            className={`chip ${order === "bottom" ? "active" : ""}`}
            style={{ fontSize: 11.5 }}
            onClick={() => setOrder("bottom")}
          >
            Menos usados
          </button>
        </div>
      </div>
      {used.length === 0 ? (
        <p className="text-dim text-sm">Sin consumo este mes todavía.</p>
      ) : (
        <>
          <div className="text-faint mb-3 text-[11.5px]">
            Consumo real por ventas · total{" "}
            <b className="text-fg">{fmtG(total)}</b>
          </div>
          <div className="flex flex-col gap-2">
            {sorted.map((u, i) => {
              const pct = Math.max(4, Math.round((u.grams / max) * 100));
              const tone = u.hex ?? "var(--gold)";
              return (
                <div
                  key={`${u.material}-${u.color}-${i}`}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className="shrink-0"
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: tone,
                      border: "1px solid var(--border-strong)",
                    }}
                  />
                  <span
                    className="text-fg w-32 shrink-0 truncate text-[12.5px]"
                    title={`${u.material} · ${u.color}`}
                  >
                    {u.material} · {u.color}
                  </span>
                  <div
                    className="h-2.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: tone,
                        // Intensidad tipo mapa de calor.
                        opacity: 0.45 + 0.55 * (u.grams / max),
                      }}
                    />
                  </div>
                  <b className="w-16 shrink-0 text-right text-[12px]">
                    {fmtG(u.grams)}
                  </b>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
