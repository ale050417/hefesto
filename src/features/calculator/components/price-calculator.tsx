"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { formatPrice } from "@/lib/format";
import { FILAMENT_COLORS } from "@/features/inventory/constants";
import { computeQuote } from "../calculator";
import { saveCalcAction, deleteCalcAction } from "../actions";
import type { CalcConfig } from "../service";
import type { CalcHistoryRow } from "../repository";

const svg = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    dangerouslySetInnerHTML={{ __html: path }}
  />
);
const I = {
  trending:
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0"/>',
  weight:
    '<path d="M12 3a4 4 0 0 0-4 4h8a4 4 0 0 0-4-4z"/><path d="M6.5 7h11l2.5 12a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dollar:
    '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  printer:
    '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  alert:
    '<path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

type Stats = {
  count: number;
  grams: number;
  hours: number;
  ganancia: number;
  precioFinal: number;
};

export function PriceCalculator({
  config,
  materials,
  costMap,
  history,
  stats,
}: {
  config: CalcConfig;
  materials: string[];
  costMap: Record<string, number>;
  history: CalcHistoryRow[];
  stats: Stats;
}) {
  const router = useRouter();
  const mats = materials.length ? materials : ["PLA"];
  const [f, setF] = useState({
    name: "",
    customer: "",
    material: mats[0]!,
    color: "Negro",
    grams: "",
    hours: "",
    minutes: "",
    marginPct: "200",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"fecha" | "precio" | "nombre">("fecha");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const costPerKg = costMap[f.material] ?? 0;
  const grams = Number(f.grams) || 0;
  const totalHours = (Number(f.hours) || 0) + (Number(f.minutes) || 0) / 60;
  const hasData = grams > 0 || totalHours > 0;

  const q = computeQuote({
    grams,
    hours: totalHours,
    costPerKg,
    kwhPrice: config.kwhPrice,
    machineWatts: config.machineWatts,
    machineLifeHours: config.machineLifeHours,
    maintenanceCost: config.maintenanceCost,
    marginErrorPct: config.marginErrorPct,
    marginPct: Number(f.marginPct) || 0,
  });

  async function save() {
    if (!f.name.trim())
      return toast("Ingresá un nombre para el cálculo", "danger");
    if (!hasData) return toast("Cargá gramos u horas", "danger");
    setBusy(true);
    const res = await saveCalcAction({
      name: f.name,
      customer: f.customer,
      material: f.material,
      color: f.color,
      grams,
      hours: totalHours,
      costPerKg,
      marginPct: Number(f.marginPct) || 0,
      notes: f.notes,
    });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Presupuesto guardado en el historial", "success");
    setF((s) => ({
      ...s,
      name: "",
      customer: "",
      grams: "",
      hours: "",
      minutes: "",
      notes: "",
    }));
    router.refresh();
  }

  async function remove(id: string) {
    setPendingId(id);
    const res = await deleteCalcAction(id);
    setPendingId(null);
    if (res.ok) {
      toast("Cálculo eliminado", "danger");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = history.filter(
      (h) =>
        !term ||
        h.name.toLowerCase().includes(term) ||
        (h.customer ?? "").toLowerCase().includes(term),
    );
    list = [...list].sort((a, b) => {
      if (sort === "precio")
        return Number(b.precioFinal) - Number(a.precioFinal);
      if (sort === "nombre") return a.name.localeCompare(b.name);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [history, search, sort]);

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = [
      "Nombre",
      "Cliente",
      "Material",
      "Gramos",
      "Horas",
      "Margen%",
      "Costo",
      "Ganancia",
      "Precio",
    ].join(",");
    const lines = filtered.map((h) =>
      [
        esc(h.name),
        esc(h.customer ?? ""),
        esc(h.material ?? ""),
        h.grams,
        h.hours,
        h.marginPct,
        h.costoTotal,
        h.ganancia,
        h.precioFinal,
      ].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calculos-hefesto.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const bd: Array<[string, string, string, number, string]> = [
    [
      "Costo material",
      I.box,
      "#5A9CD9",
      q.material,
      costPerKg ? `${formatPrice(costPerKg)}/kg` : "",
    ],
    ["Electricidad", I.bolt, "#D9A441", q.electricidad, ""],
    ["Desgaste impresora", I.printer, "#9B7BD4", q.desgaste, ""],
    ["Margen de error", I.alert, "#D96A5A", q.margenError, ""],
  ];
  const maxc = Math.max(...bd.map((x) => x[3]), 1);

  const statCards: Array<[string, string, string]> = [
    [I.trending, formatPrice(stats.ganancia), "Ganancias calculadas"],
    [I.calc, String(stats.count), "Piezas presupuestadas"],
    [I.weight, `${(stats.grams / 1000).toFixed(2)} kg`, "Material consumido"],
    [I.clock, `${stats.hours.toFixed(1)} h`, "Horas impresas"],
    [I.dollar, formatPrice(stats.precioFinal), "Facturación estimada"],
  ];

  return (
    <div className="grid gap-5">
      <div className="calc-stats">
        {statCards.map(([icon, n, l]) => (
          <div className="calc-stat" key={l}>
            <div className="cs-ic">{svg(icon)}</div>
            <div className="cs-n">{n}</div>
            <div className="cs-l">{l}</div>
          </div>
        ))}
      </div>

      <div className="calc-grid">
        {/* FORM */}
        <div className="ui-card section-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="section-title">Nuevo presupuesto</div>
            <span className="badge badge-success">Tiempo real</span>
          </div>
          <div className="flex flex-col gap-4">
            <div className="calc-input-row">
              <div className="field">
                <label htmlFor="ci-nombre">Nombre de la pieza</label>
                <input
                  id="ci-nombre"
                  className="input"
                  placeholder="Ej: Soporte auriculares"
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ci-cliente">Cliente</label>
                <input
                  id="ci-cliente"
                  className="input"
                  placeholder="Opcional"
                  value={f.customer}
                  onChange={(e) => set("customer", e.target.value)}
                />
              </div>
            </div>
            <div className="calc-input-row">
              <div className="field">
                <label htmlFor="ci-mat">Material</label>
                <select
                  id="ci-mat"
                  className="select"
                  value={f.material}
                  onChange={(e) => set("material", e.target.value)}
                >
                  {mats.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ci-color">Color</label>
                <select
                  id="ci-color"
                  className="select"
                  value={f.color}
                  onChange={(e) => set("color", e.target.value)}
                >
                  {FILAMENT_COLORS.map((c) => (
                    <option key={c.n} value={c.n}>
                      {c.n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div
              className="text-[12px]"
              style={{ color: "var(--success)", marginTop: -6 }}
            >
              {costPerKg
                ? `Filamento ${f.material}: ${formatPrice(costPerKg)}/kg`
                : `Sin costo/kg cargado para ${f.material} (cargalo en Filamentos).`}
            </div>
            <div className="field">
              <label className="flex items-center justify-between">
                Gramos utilizados
                <span className="calc-slider-val">{grams} g</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  className="range range-green"
                  min={0}
                  max={1000}
                  step={5}
                  value={Math.min(grams, 1000)}
                  onChange={(e) => set("grams", e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  value={f.grams}
                  placeholder="0"
                  style={{ width: 90 }}
                  onChange={(e) => set("grams", e.target.value)}
                />
              </div>
            </div>
            <div className="calc-input-row">
              <div className="field">
                <label htmlFor="ci-h">Horas de impresión</label>
                <input
                  id="ci-h"
                  className="input"
                  type="number"
                  placeholder="0"
                  value={f.hours}
                  onChange={(e) => set("hours", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="ci-m">Minutos</label>
                <input
                  id="ci-m"
                  className="input"
                  type="number"
                  placeholder="0"
                  value={f.minutes}
                  onChange={(e) => set("minutes", e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="ci-margin">Margen de ganancia (%)</label>
              <input
                id="ci-margin"
                className="input"
                type="number"
                placeholder="200"
                value={f.marginPct}
                onChange={(e) => set("marginPct", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ci-obs">Observaciones</label>
              <textarea
                id="ci-obs"
                className="textarea"
                placeholder="Notas internas del presupuesto..."
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <Button type="button" onClick={save} disabled={busy}>
              {busy ? "Guardando…" : "Guardar en el historial"}
            </Button>
          </div>
        </div>

        {/* DESGLOSE */}
        <div className="ui-card section-card">
          <div className="mb-4 flex items-center justify-between">
            <div className="section-title">Desglose detallado</div>
            <span className="text-faint text-[12px]">
              {f.name || "Sin nombre"} · {totalHours.toFixed(1)} h
            </span>
          </div>
          {!hasData ? (
            <div className="calc-empty">
              {svg(I.calc)}
              <div style={{ fontWeight: 600, color: "var(--fg)" }}>
                Completá los datos
              </div>
              <div style={{ fontSize: 13, marginTop: 6, maxWidth: 300 }}>
                El desglose de costos y el precio final aparecen acá,
                actualizándose en tiempo real.
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3">
                {bd.map(([l, icon, col, val, sub]) => (
                  <div className="bd-card" key={l}>
                    <div className="bd-top">
                      <span className="flex items-center gap-2">
                        <span
                          className="bd-ic"
                          style={{ background: `${col}1f`, color: col }}
                        >
                          {svg(icon)}
                        </span>
                        <span className="bd-label">
                          {l}
                          {sub ? (
                            <span
                              className="text-faint"
                              style={{ fontSize: 11 }}
                            >
                              {" "}
                              · {sub}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="bd-val">{formatPrice(val)}</span>
                    </div>
                    <div className="bd-bar">
                      <div
                        style={{
                          width: `${Math.max((val / maxc) * 100, 3)}%`,
                          background: col,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mb-4 flex items-center justify-between"
                style={{
                  padding: "12px 4px",
                  borderTop: "1px solid var(--border)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span className="text-dim flex items-center gap-2 text-[13.5px]">
                  {svg(I.dollar)} Costo total de producción
                </span>
                <b className="price text-[18px]">{formatPrice(q.costoTotal)}</b>
              </div>
              <div className="calc-final">
                <div className="flex items-center justify-between">
                  <div>
                    <div
                      className="mb-1.5 flex items-center gap-2 text-[12.5px] uppercase"
                      style={{
                        color: "var(--success)",
                        letterSpacing: ".04em",
                      }}
                    >
                      {svg(I.trending)} <b>Precio final sugerido</b>
                    </div>
                    <div className="text-faint text-[12px]">
                      Ganancia {formatPrice(q.ganancia)} · margen{" "}
                      {f.marginPct || 0}%
                    </div>
                  </div>
                  <div className="cf-val">{formatPrice(q.precioFinal)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* HISTORIAL */}
      <div className="ui-card section-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="section-title">Historial de cálculos</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="search" style={{ width: 220 }}>
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
                placeholder="Buscar pieza o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="select"
              style={{ width: "auto" }}
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="fecha">Más recientes</option>
              <option value="precio">Mayor precio</option>
              <option value="nombre">Nombre</option>
            </select>
            <button
              className="btn btn-secondary btn-sm"
              onClick={exportCsv}
              type="button"
            >
              Exportar CSV
            </button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p className="text-dim py-6 text-center text-sm">
            {history.length === 0
              ? "Todavía no guardaste cálculos."
              : "Sin resultados."}
          </p>
        ) : (
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pieza</th>
                  <th>Cliente</th>
                  <th>Material</th>
                  <th className="text-right">Gramos</th>
                  <th className="text-right">Precio</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.name}</b>
                    </td>
                    <td className="muted">{h.customer ?? "—"}</td>
                    <td className="muted">{h.material ?? "—"}</td>
                    <td className="text-right">{Number(h.grams)} g</td>
                    <td className="price text-right">
                      <b style={{ color: "var(--gold-bright)" }}>
                        {formatPrice(Number(h.precioFinal))}
                      </b>
                    </td>
                    <td className="muted whitespace-nowrap">
                      {dateFmt.format(new Date(h.createdAt))}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn-icon btn-ghost"
                        title="Eliminar"
                        disabled={pendingId === h.id}
                        onClick={() => remove(h.id)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
