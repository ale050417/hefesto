"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { computeQuote } from "../calculator";
import { quotePriceAction } from "../actions";
import type { CalcConfig, MarginPreset, MarginPresetOption } from "../service";

// Solo trabajamos estas dos alturas de capa.
export const LAYER_HEIGHTS = ["0.20 mm", "0.40 mm"] as const;

export type EstimatorValue = {
  material: string;
  grams: number;
  printMinutes: number;
  layerHeight: string;
  presetId: string;
  /** Precio final calculado (admin: cliente; operador: servidor). Null si falta dato. */
  price: number | null;
};

/**
 * Motor de precio de la calculadora, embebible en el alta de producto y en el
 * pedido manual. Admin: calcula en el cliente y muestra el desglose. Operador:
 * el precio lo da el servidor (no ve margen ni costos). Reporta el resultado por
 * `onChange` para que el formulario que lo embeba lo use (precio / total).
 */
export function PriceEstimator({
  config,
  materials,
  costMap,
  presetOptions,
  presets,
  isAdmin,
  initial,
  onChange,
}: {
  config: CalcConfig;
  materials: string[];
  costMap: Record<string, number>;
  presetOptions: MarginPresetOption[];
  presets: MarginPreset[];
  isAdmin: boolean;
  initial?: Partial<{
    material: string;
    grams: number;
    printMinutes: number;
    layerHeight: string;
    presetId: string;
  }>;
  onChange?: (v: EstimatorValue) => void;
}) {
  const mats = materials.length ? materials : ["PLA"];
  const initMin = initial?.printMinutes ?? 0;
  const [material, setMaterial] = useState(initial?.material || mats[0]!);
  const [grams, setGrams] = useState(
    initial?.grams ? String(initial.grams) : "",
  );
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

  const gramsN = Number(grams) || 0;
  const totalMin = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const totalHours = totalMin / 60;
  const costPerKg = costMap[material] ?? 0;
  const hasData = gramsN > 0 || totalMin > 0;

  // Margen del tipo: SOLO admin lo conoce (presets viene vacío al operador).
  const adminMargin = isAdmin
    ? (presets.find((p) => p.id === presetId)?.marginPct ?? 0)
    : 0;

  const q = computeQuote({
    grams: gramsN,
    hours: totalHours,
    costPerKg,
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
      if (!hasData || !presetId) {
        setOpPrice(null);
        setOpBusy(false);
        return;
      }
      setOpBusy(true);
      quotePriceAction({
        presetId,
        grams: gramsN,
        hours: totalHours,
        material,
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
  }, [isAdmin, presetId, material, gramsN, totalHours, hasData]);

  const price = isAdmin
    ? hasData && presetId
      ? q.precioFinal
      : null
    : opPrice;

  // Reporta el resultado al formulario contenedor. onChange queda fuera de deps
  // a propósito (puede cambiar de identidad por render); emitimos por valores.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.({
      material,
      grams: gramsN,
      printMinutes: totalMin,
      layerHeight,
      presetId,
      price,
    });
  }, [material, gramsN, totalMin, layerHeight, presetId, price]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid-2">
        <div className="field">
          <label htmlFor="pe-mat">Material</label>
          <select
            id="pe-mat"
            className="select"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          >
            {mats.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div
            className="text-[11.5px]"
            style={{ color: costPerKg ? "var(--success)" : "var(--warning)" }}
          >
            {costPerKg
              ? `${formatPrice(costPerKg)}/kg`
              : `Sin costo/kg para ${material} (cargalo en Filamentos)`}
          </div>
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
        <label htmlFor="pe-grams">Gramos</label>
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
