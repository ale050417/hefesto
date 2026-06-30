"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { useCan } from "@/components/auth/perms-provider";
import { saveCalcConfigAction } from "../actions";
import type { CalcConfig } from "../service";

export function CalcConfigButton({ config }: { config: CalcConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canEdit = useCan("calculadora", "editar");
  const [form, setForm] = useState({
    kwhPrice: String(config.kwhPrice),
    machineWatts: String(config.machineWatts),
    machineLifeHours: String(config.machineLifeHours),
    maintenanceCost: String(config.maintenanceCost),
    marginErrorPct: String(config.marginErrorPct),
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    const res = await saveCalcConfigAction(form);
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    toast("Configuración guardada", "success");
    setOpen(false);
    router.refresh();
  }

  const fields: Array<[keyof typeof form, string]> = [
    ["kwhPrice", "Precio del kWh"],
    ["machineWatts", "Consumo (watts)"],
    ["machineLifeHours", "Vida útil (horas)"],
    ["maintenanceCost", "Costo de mantenimiento"],
    ["marginErrorPct", "Margen de error (%)"],
  ];

  if (!canEdit) return null;

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
        Configuración global
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Configuración de costos"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Se usa para estimar electricidad, desgaste de máquina y margen de
            error. El material sale del costo/kg de cada filamento.
          </p>
          <div className="grid-2">
            {fields.map(([k, label]) => (
              <div className="field" key={k}>
                <label htmlFor={`cc-${k}`}>{label}</label>
                <input
                  id={`cc-${k}`}
                  type="number"
                  className="input"
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
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
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
