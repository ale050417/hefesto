"use client";

import { useRouter } from "next/navigation";

export type FilamentUsageRow = {
  material: string;
  color: string;
  hex: string | null;
  grams: number;
};

const fmtG = (g: number) =>
  g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;

/** Los últimos 12 meses para el selector ("julio 2026" → "2026-07"). */
function monthOptions(): Array<{ value: string; label: string }> {
  const fmt = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  });
  const out: Array<{ value: string; label: string }> = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < 12; i++) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: fmt.format(d) });
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/**
 * "Filamentos más usados" del panel (3ª versión, 2026-07-24): ANCHO COMPLETO,
 * ordenado SIEMPRE del más al menos usado, solo filamentos con uso, y un
 * selector de MES (al cambiar el mes calendario, el corriente arranca limpio
 * solo; los anteriores quedan consultables acá). Barra con el color real e
 * intensidad proporcional al más usado.
 */
export function FilamentUsageCard({
  rows,
  selectedMonth,
}: {
  rows: FilamentUsageRow[];
  /** Mes elegido, "YYYY-MM". */
  selectedMonth: string;
}) {
  const router = useRouter();
  const months = monthOptions();
  const used = rows.filter((r) => r.grams > 0);
  const max = Math.max(1, ...used.map((u) => u.grams));
  const total = used.reduce((a, u) => a + u.grams, 0);
  const sorted = [...used].sort((a, b) => b.grams - a.grams);

  return (
    <div className="ui-card section-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="section-title">Filamentos más usados</div>
        <div className="flex items-center gap-2">
          <span className="text-faint text-[12px]">
            Total: <b className="text-fg">{fmtG(total)}</b>
          </span>
          <select
            className="select"
            style={{ width: "auto", paddingBlock: 6, fontSize: 13 }}
            value={selectedMonth}
            onChange={(e) => {
              const v = e.target.value;
              // Mes actual = URL limpia; otro mes = ?mes=YYYY-MM.
              router.push(
                v === months[0]?.value ? "/admin" : `/admin?mes=${v}`,
              );
            }}
            aria-label="Mes del consumo"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {used.length === 0 ? (
        <p className="text-dim py-3 text-sm">
          Sin consumo registrado en ese mes.
        </p>
      ) : (
        <div className="mt-1 flex flex-col gap-2.5">
          {sorted.map((u, i) => {
            const pct = Math.max(4, Math.round((u.grams / max) * 100));
            const tone = u.hex ?? "var(--gold)";
            return (
              <div
                key={`${u.material}-${u.color}-${i}`}
                className="flex items-center gap-3"
              >
                <span
                  className="shrink-0"
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    background: tone,
                    border: "1px solid var(--border-strong)",
                  }}
                />
                <span
                  className="text-fg w-40 shrink-0 truncate text-[13px]"
                  title={`${u.material} · ${u.color}`}
                >
                  {u.material} · {u.color}
                </span>
                <div
                  className="h-3.5 flex-1 overflow-hidden rounded-full"
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
                <b className="w-20 shrink-0 text-right text-[13px]">
                  {fmtG(u.grams)}
                </b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
