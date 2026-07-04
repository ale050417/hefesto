"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveFilamentAction } from "../actions";
import {
  FILAMENT_BRANDS,
  FILAMENT_COLORS,
  FILAMENT_DIAMETERS,
  FILAMENT_MATERIALS,
} from "../constants";

export type FilamentFormData = {
  id?: string;
  material: string;
  color: string;
  brand: string;
  diameter: string;
  stockGrams: number;
  spoolGrams: number;
  costPerKg: number;
  alertThresholdGrams: number;
};

const DEFAULTS: FilamentFormData = {
  material: "PLA",
  color: "Negro",
  brand: "Grilon3",
  diameter: "1.75",
  stockGrams: 0,
  spoolGrams: 1000,
  costPerKg: 18000,
  alertThresholdGrams: 1000,
};

export function FilamentForm({
  filament,
  onDone,
  onCancel,
}: {
  filament?: FilamentFormData;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const edit = !!filament?.id;
  const init = filament ?? DEFAULTS;
  const [form, setForm] = useState({
    material: init.material,
    color: init.color,
    brand: init.brand,
    diameter: init.diameter,
    stockGrams: String(init.stockGrams ?? 0),
    spoolGrams: String(init.spoolGrams ?? 1000),
    costPerKg: String(init.costPerKg ?? 0),
    alertThresholdGrams: String(init.alertThresholdGrams ?? 0),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await saveFilamentAction(form, filament?.id);
      if (!res.ok) return setErr(res.error.message);
      toast(edit ? "Filamento actualizado" : "Filamento agregado", "success");
      onDone?.();
      router.refresh();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-mat">Material</label>
          <select
            id="fm-mat"
            className="select"
            value={form.material}
            onChange={(e) => set("material", e.target.value)}
          >
            {FILAMENT_MATERIALS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fm-color">Color</label>
          <select
            id="fm-color"
            className="select"
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
          >
            {FILAMENT_COLORS.map((fc) => (
              <option key={fc.n} value={fc.n}>
                {fc.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-brand">Marca</label>
          <select
            id="fm-brand"
            className="select"
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
          >
            {FILAMENT_BRANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fm-dia">Diámetro (mm)</label>
          <select
            id="fm-dia"
            className="select"
            value={form.diameter}
            onChange={(e) => set("diameter", e.target.value)}
          >
            {FILAMENT_DIAMETERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-stock">Stock actual (g)</label>
          <input
            id="fm-stock"
            type="number"
            className="input"
            placeholder="0"
            value={form.stockGrams}
            onChange={(e) => set("stockGrams", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fm-spool">Tamaño del carrete (g)</label>
          <input
            id="fm-spool"
            type="number"
            className="input"
            placeholder="1000"
            value={form.spoolGrams}
            onChange={(e) => set("spoolGrams", e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fm-cost">Costo por kg</label>
          <input
            id="fm-cost"
            type="number"
            className="input"
            value={form.costPerKg}
            onChange={(e) => set("costPerKg", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fm-alert">Alerta de stock bajo (g)</label>
          <input
            id="fm-alert"
            type="number"
            className="input"
            value={form.alertThresholdGrams}
            onChange={(e) => set("alertThresholdGrams", e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Agregar filamento"}
        </Button>
      </div>
    </div>
  );
}
