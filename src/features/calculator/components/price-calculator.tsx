"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import { computePrintPrice } from "../calculator";

const labelCls = "mb-1 block text-xs font-medium text-dim";

export function PriceCalculator() {
  const [weightGrams, setWeight] = useState(150);
  const [printHours, setHours] = useState(4);
  const [materialCostPerKg, setPerKg] = useState(12000);
  const [machineRatePerHour, setPerHour] = useState(600);
  const [extraCost, setExtra] = useState(0);
  const [marginPct, setMargin] = useState(120);

  const r = computePrintPrice({
    weightGrams,
    printHours,
    materialCostPerKg,
    machineRatePerHour,
    extraCost,
    marginPct,
  });

  const num =
    (set: (n: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) =>
      set(Number(e.target.value));

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="ui-card grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="w">
            Peso de la pieza (g)
          </label>
          <input
            id="w"
            type="number"
            min="0"
            className="input"
            value={weightGrams}
            onChange={num(setWeight)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="h">
            Tiempo de impresión (h)
          </label>
          <input
            id="h"
            type="number"
            min="0"
            step="0.1"
            className="input"
            value={printHours}
            onChange={num(setHours)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="kg">
            Costo del filamento ($/kg)
          </label>
          <input
            id="kg"
            type="number"
            min="0"
            className="input"
            value={materialCostPerKg}
            onChange={num(setPerKg)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hr">
            Costo de máquina + luz ($/h)
          </label>
          <input
            id="hr"
            type="number"
            min="0"
            className="input"
            value={machineRatePerHour}
            onChange={num(setPerHour)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex">
            Insumos extra ($)
          </label>
          <input
            id="ex"
            type="number"
            min="0"
            className="input"
            value={extraCost}
            onChange={num(setExtra)}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="mg">
            Margen de ganancia (%)
          </label>
          <input
            id="mg"
            type="number"
            min="0"
            className="input"
            value={marginPct}
            onChange={num(setMargin)}
          />
        </div>
      </div>

      <aside className="ui-card grid h-fit gap-2 p-6">
        <Row label="Material" value={r.materialCost} />
        <Row label="Tiempo de máquina" value={r.timeCost} />
        <Row label="Insumos extra" value={r.extraCost} />
        <div className="my-1 border-t border-[var(--border)]" />
        <Row label="Costo base" value={r.base} />
        <Row label="Margen" value={r.margin} />
        <div className="my-1 border-t border-[var(--border)]" />
        <div className="flex items-center justify-between">
          <span className="text-fg font-medium">Precio sugerido</span>
          <span className="text-2xl font-semibold text-[var(--gold-bright)]">
            {formatPrice(r.price)}
          </span>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-dim">{label}</span>
      <span className="text-fg">{formatPrice(value)}</span>
    </div>
  );
}
