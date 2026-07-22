"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveCostSettingsAction } from "../actions";
import type { CostSettings } from "../economics";
import { runAction } from "@/lib/run-action";

export function CostSettingsButton({ settings }: { settings: CostSettings }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kwhPrice: String(settings.kwhPrice),
    machineWatts: String(settings.machineWatts),
    machineLifeHours: String(settings.machineLifeHours),
    maintenanceCost: String(settings.maintenanceCost),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await runAction(() => saveCostSettingsAction(form), {
        silent: true,
      });
      if (!res.ok) return setErr(res.error.message);
      toast("Config de costos guardada", "success");
      setOpen(false);
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
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
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.81 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 9.4a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6V4.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19 9.4l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z" />
        </svg>
        Config de costos
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Configuración de costos"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Se usa para estimar la amortización por pieza (luz + desgaste de
            máquina). El material sale del costo/kg de cada filamento.
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="cs-kwh">Precio del kWh</label>
              <input
                id="cs-kwh"
                type="number"
                className="input"
                value={form.kwhPrice}
                onChange={(e) => set("kwhPrice", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cs-watts">Consumo (watts)</label>
              <input
                id="cs-watts"
                type="number"
                className="input"
                value={form.machineWatts}
                onChange={(e) => set("machineWatts", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cs-life">Vida útil (horas)</label>
              <input
                id="cs-life"
                type="number"
                className="input"
                value={form.machineLifeHours}
                onChange={(e) => set("machineLifeHours", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cs-maint">Costo de mantenimiento</label>
              <input
                id="cs-maint"
                type="number"
                className="input"
                value={form.maintenanceCost}
                onChange={(e) => set("maintenanceCost", e.target.value)}
              />
            </div>
          </div>
          {err ? (
            <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
              {err}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submit} loading={busy}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
