"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { deleteMarginPresetAction, saveMarginPresetAction } from "../actions";
import type { MarginPreset } from "../service";

type Row = {
  key: string;
  id?: string;
  name: string;
  marginPct: string;
  active: boolean;
};

let tmp = 0;
const newKey = () => `tmp-${tmp++}`;

/**
 * Admin: alta/edición/activación/borrado de los tipos de producto con margen.
 * El operador nunca ve este botón (la página lo renderiza solo para admin).
 */
export function MarginPresetsButton({ presets }: { presets: MarginPreset[] }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => toRows(presets));
  const [busy, setBusy] = useState(false);

  function toRows(list: MarginPreset[]): Row[] {
    return list.map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      marginPct: String(p.marginPct),
      active: p.active,
    }));
  }

  function openModal() {
    setRows(toRows(presets)); // re-sincroniza con lo último del servidor
    setOpen(true);
  }

  const set = (key: string, field: keyof Row, value: string | boolean) =>
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { key: newKey(), name: "", marginPct: "100", active: true },
    ]);
  const removeRow = (key: string) =>
    setRows((rs) => rs.filter((r) => r.key !== key));

  async function save() {
    const clean = rows.filter((r) => r.name.trim());
    if (clean.some((r) => !(Number(r.marginPct) >= 0))) {
      return toast("Revisá los márgenes (deben ser ≥ 0).", "danger");
    }
    setBusy(true);
    try {
      const keptIds = new Set(clean.filter((r) => r.id).map((r) => r.id));
      const removed = presets.filter((p) => !keptIds.has(p.id));
      const results = await Promise.all([
        ...clean.map((r, i) =>
          saveMarginPresetAction(r.id ?? null, {
            name: r.name.trim(),
            marginPct: Number(r.marginPct) || 0,
            active: r.active,
            sortOrder: i,
          }),
        ),
        ...removed.map((p) => deleteMarginPresetAction(p.id)),
      ]);
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        toast(failed.error.message || "No se pudo guardar.", "danger");
        return;
      }
      toast("Tipos guardados", "success");
      setOpen(false);
    } catch {
      toast("No se pudo guardar los tipos", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={openModal}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Tipos y márgenes
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tipos de producto y margen"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Definí cada tipo (ej: Llaveros 2 colores, Macetas) con su % de
            ganancia. El operador elige el tipo en la calculadora sin ver el
            margen. Desactivá un tipo para ocultarlo sin borrarlo.
          </p>

          <div className="flex flex-col gap-2">
            <div className="text-faint flex items-center gap-2 px-1 text-[11.5px] uppercase">
              <span className="flex-1">Nombre</span>
              <span style={{ width: 110 }}>Margen %</span>
              <span style={{ width: 70 }}>Activo</span>
              <span style={{ width: 32 }} />
            </div>
            {rows.length === 0 ? (
              <p className="text-dim py-3 text-center text-sm">
                Todavía no hay tipos. Agregá el primero.
              </p>
            ) : (
              rows.map((r) => (
                <div key={r.key} className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Ej: Llaveros 2 colores"
                    value={r.name}
                    onChange={(e) => set(r.key, "name", e.target.value)}
                  />
                  <input
                    className="input"
                    style={{ width: 110 }}
                    type="number"
                    min={0}
                    value={r.marginPct}
                    onChange={(e) => set(r.key, "marginPct", e.target.value)}
                  />
                  <label
                    className="flex items-center justify-center"
                    style={{ width: 70 }}
                  >
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => set(r.key, "active", e.target.checked)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    style={{ width: 32 }}
                    onClick={() => removeRow(r.key)}
                    aria-label="Quitar tipo"
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
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addRow}
            >
              + Agregar tipo
            </button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={save} disabled={busy}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
