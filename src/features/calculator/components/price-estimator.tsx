"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { computeQuote } from "../calculator";
import { quotePriceAction } from "../actions";
import type {
  CalcConfig,
  FilamentOption,
  MarginPreset,
  MarginPresetOption,
} from "../service";

// Solo trabajamos estas dos alturas de capa.
export const LAYER_HEIGHTS = ["0.20 mm", "0.40 mm"] as const;

export type EstimatorValue = {
  /** Filamento elegido (null si no hay filamentos cargados). */
  filamentId: string | null;
  material: string;
  color: string;
  grams: number;
  printMinutes: number;
  layerHeight: string;
  presetId: string;
  /** Precio final calculado (admin: cliente; operador: servidor). Null si falta dato. */
  price: number | null;
};

/** Etiqueta del selector: "PLA · Dorado — $35.000/kg". */
function filamentLabel(f: FilamentOption): string {
  return `${f.material} · ${f.color} — ${formatPrice(f.costPerKg)}/kg`;
}

/**
 * Motor de precio de la calculadora, embebible en el alta de producto y en el
 * pedido manual. Admin: calcula en el cliente y muestra el desglose. Operador:
 * el precio lo da el servidor (no ve margen ni costos). Reporta el resultado por
 * `onChange` para que el formulario que lo embeba lo use (precio / total).
 *
 * Fix auditoría 2026-07: se elige un FILAMENTO (id), no un material. Dos
 * filamentos del mismo material pueden costar distinto (PLA dorado ≠ PLA
 * blanco) y antes el precio no cambiaba al elegir uno u otro.
 */
export function PriceEstimator({
  config,
  filaments,
  presetOptions,
  presets,
  isAdmin,
  initial,
  onChange,
}: {
  config: CalcConfig;
  filaments: FilamentOption[];
  presetOptions: MarginPresetOption[];
  presets: MarginPreset[];
  isAdmin: boolean;
  initial?: Partial<{
    filamentId: string;
    material: string;
    grams: number;
    printMinutes: number;
    layerHeight: string;
    presetId: string;
  }>;
  onChange?: (v: EstimatorValue) => void;
}) {
  const initMin = initial?.printMinutes ?? 0;
  // Default: el filamento inicial (edición), o el primero que coincida con el
  // material guardado (productos viejos, sin filamentId), o el primero.
  const [filamentId, setFilamentId] = useState<string>(() => {
    if (initial?.filamentId) return initial.filamentId;
    if (initial?.material) {
      const byMat = filaments.find((f) => f.material === initial.material);
      if (byMat) return byMat.id;
    }
    return filaments[0]?.id ?? "";
  });
  const [grams, setGrams] = useState(
    initial?.grams ? String(initial.grams) : "",
  );
  // Multicolor: materiales EXTRA (además del principal), cada uno con su
  // filamento y sus gramos; el costo de material los suma a todos.
  const [extras, setExtras] = useState<
    Array<{ filamentId: string; grams: string }>
  >([]);
  const [hours, setHours] = useState(
    initMin ? String(Math.floor(initMin / 60)) : "",
  );
  const [minutes, setMinutes] = useState(initMin ? String(initMin % 60) : "");
  const [layerHeight, setLayerHeight] = useState(
    initial?.layerHeight || LAYER_HEIGHTS[0],
  );
  // Arranca SIN tipo: así no pisa un precio ya guardado (edición). El precio se
  // calcula recién cuando elegís un tipo.
  const [presetId, setPresetId] = useState(initial?.presetId || "");
  const [opPrice, setOpPrice] = useState<number | null>(null);
  const [opBusy, setOpBusy] = useState(false);

  const selected = filaments.find((f) => f.id === filamentId) ?? null;
  const gramsN = Number(grams) || 0;
  const totalMin = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const totalHours = totalMin / 60;
  const costPerKg = selected?.costPerKg ?? 0;
  const hasData = gramsN > 0 || totalMin > 0;

  // Margen del tipo: SOLO admin lo conoce (presets viene vacío al operador).
  const adminMargin = isAdmin
    ? (presets.find((p) => p.id === presetId)?.marginPct ?? 0)
    : 0;

  // Materiales extra válidos (con gramos) → el core suma principal + extras.
  const extraMats = extras
    .map((e) => ({
      grams: Number(e.grams) || 0,
      costPerKg: filaments.find((f) => f.id === e.filamentId)?.costPerKg ?? 0,
    }))
    .filter((m) => m.grams > 0);
  const materials =
    extraMats.length > 0
      ? [{ grams: gramsN, costPerKg }, ...extraMats]
      : undefined;

  const q = computeQuote({
    grams: gramsN,
    hours: totalHours,
    costPerKg,
    materials,
    kwhPrice: config.kwhPrice,
    machineWatts: config.machineWatts,
    machineLifeHours: config.machineLifeHours,
    maintenanceCost: config.maintenanceCost,
    marginErrorPct: config.marginErrorPct,
    marginPct: adminMargin,
  });

  // Operador: el precio lo calcula el servidor (debounce). setState siempre va
  // dentro del callback async (no rompe la regla set-state-in-effect).
  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!hasData || !presetId || !filamentId) {
        setOpPrice(null);
        setOpBusy(false);
        return;
      }
      setOpBusy(true);
      quotePriceAction({
        presetId,
        grams: gramsN,
        hours: totalHours,
        filamentId,
      }).then((res) => {
        if (cancelled) return;
        setOpPrice(res.ok ? res.data.precioFinal : null);
        setOpBusy(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAdmin, presetId, filamentId, gramsN, totalHours, hasData]);

  const price = isAdmin
    ? hasData && presetId && selected
      ? q.precioFinal
      : null
    : opPrice;

  // Reporta el resultado al formulario contenedor. onChange queda fuera de deps
  // a propósito (puede cambiar de identidad por render); emitimos por valores.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const material = selected?.material ?? "";
  const color = selected?.color ?? "";
  useEffect(() => {
    onChangeRef.current?.({
      filamentId: filamentId || null,
      material,
      color,
      grams: gramsN,
      printMinutes: totalMin,
      layerHeight,
      presetId,
      price,
    });
  }, [
    filamentId,
    material,
    color,
    gramsN,
    totalMin,
    layerHeight,
    presetId,
    price,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid-2">
        <div className="field">
          <label htmlFor="pe-fil">Filamento</label>
          {filaments.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--warning)" }}>
              No hay filamentos cargados. Cargá uno en Filamentos para cotizar.
            </p>
          ) : (
            <select
              id="pe-fil"
              className="select"
              value={filamentId}
              onChange={(e) => setFilamentId(e.target.value)}
            >
              {filaments.map((f) => (
                <option key={f.id} value={f.id}>
                  {filamentLabel(f)}
                </option>
              ))}
            </select>
          )}
          {selected && !selected.costPerKg ? (
            <div className="text-[11.5px]" style={{ color: "var(--warning)" }}>
              Este filamento no tiene costo/kg cargado (editalo en Filamentos).
            </div>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="pe-layer">Altura de capa</label>
          <select
            id="pe-layer"
            className="select"
            value={layerHeight}
            onChange={(e) => setLayerHeight(e.target.value)}
          >
            {LAYER_HEIGHTS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="pe-grams">
          Gramos{extras.length > 0 ? " (material principal)" : ""}
        </label>
        <input
          id="pe-grams"
          className="input"
          type="number"
          min={0}
          placeholder="0"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
        />
      </div>

      {/* Multicolor: sumar más materiales, cada uno con su filamento y gramos.
          Solo admin (el precio se calcula en el cliente). */}
      {isAdmin && filaments.length > 0 ? (
        <div className="flex flex-col gap-2">
          {extras.map((ex, i) => (
            <div key={i} className="grid-2" style={{ alignItems: "end" }}>
              <div className="field">
                <label>Material extra {i + 1}</label>
                <select
                  className="select"
                  value={ex.filamentId}
                  onChange={(e) =>
                    setExtras((xs) =>
                      xs.map((x, j) =>
                        j === i ? { ...x, filamentId: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {filaments.map((f) => (
                    <option key={f.id} value={f.id}>
                      {filamentLabel(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Gramos</label>
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={ex.grams}
                    onChange={(e) =>
                      setExtras((xs) =>
                        xs.map((x, j) =>
                          j === i ? { ...x, grams: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    aria-label="Quitar material"
                    onClick={() =>
                      setExtras((xs) => xs.filter((_, j) => j !== i))
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={() =>
              setExtras((xs) => [
                ...xs,
                { filamentId: filaments[0]?.id ?? "", grams: "" },
              ])
            }
          >
            + Agregar material (multicolor)
          </button>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="pe-h">Horas de impresión</label>
          <input
            id="pe-h"
            className="input"
            type="number"
            min={0}
            placeholder="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pe-m">Minutos</label>
          <input
            id="pe-m"
            className="input"
            type="number"
            min={0}
            max={59}
            placeholder="0"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="pe-tipo">Tipo de producto</label>
        {presetOptions.length === 0 ? (
          <p className="text-faint text-[12.5px]">
            {isAdmin
              ? 'No hay tipos cargados. Creá uno en "Tipos y márgenes" (Calculadora).'
              : "No hay tipos disponibles. Avisale al administrador."}
          </p>
        ) : (
          <select
            id="pe-tipo"
            className="select"
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
          >
            <option value="">Elegí un tipo…</option>
            {presetOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {isAdmin
                  ? ` · ${presets.find((x) => x.id === p.id)?.marginPct ?? 0}%`
                  : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Resultado */}
      {isAdmin ? (
        <div
          className="ui-card flex flex-col gap-1.5"
          style={{ padding: "12px 14px" }}
        >
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-dim">Amortización (costo)</span>
            <b className="price">{formatPrice(q.costoTotal)}</b>
          </div>
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-dim">Ganancia · margen {adminMargin}%</span>
            <b className="price" style={{ color: "var(--success)" }}>
              {formatPrice(q.ganancia)}
            </b>
          </div>
          <div
            className="mt-1 flex items-center justify-between border-t pt-2"
            style={{ borderColor: "var(--border)" }}
          >
            <span className="text-[12.5px] font-semibold">Precio sugerido</span>
            <b
              className="price text-[16px]"
              style={{ color: "var(--gold-bright)" }}
            >
              {price == null ? "—" : formatPrice(price)}
            </b>
          </div>
        </div>
      ) : (
        <div
          className="ui-card flex items-center justify-between"
          style={{ padding: "13px 15px" }}
        >
          <span className="text-dim flex items-center gap-2 text-[13px]">
            Precio
          </span>
          <b
            className="price text-[18px]"
            style={{ color: "var(--gold-bright)" }}
          >
            {opBusy ? "Calculando…" : price == null ? "—" : formatPrice(price)}
          </b>
        </div>
      )}
    </div>
  );
}
