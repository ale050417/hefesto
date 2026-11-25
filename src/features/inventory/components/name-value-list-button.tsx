"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/stores/toastStore";

export type NameValueItem = {
  id: string;
  name: string;
  value: number;
  /** Texto chico al lado (ej. "12 carretes"). */
  note?: string;
};

/** Lo que hace falta del resultado de una Server Action. */
type Result = { ok: true } | { ok: false; error: { message: string } };

type Row = { key: string; id?: string; name: string; value: string };

let tmp = 0;
const newKey = () => `nuevo-${tmp++}`;

/**
 * Botón + modal para administrar una lista corta de "nombre + número": los
 * tipos de filamento con su precio y los modelos de carrete con su peso vacío
 * (pedidos de Agustín, 2026-11-24). Se edita en filas y se guarda todo junto.
 */
export function NameValueListButton({
  label,
  title,
  intro,
  namePlaceholder,
  valueLabel,
  valueSuffix,
  addLabel,
  items,
  onSave,
  onDelete,
  savedMessage = "Guardado",
}: {
  label: ReactNode;
  title: string;
  intro: ReactNode;
  namePlaceholder: string;
  valueLabel: string;
  valueSuffix: string;
  addLabel: string;
  items: NameValueItem[];
  onSave: (
    id: string | null,
    input: { name: string; value: number },
  ) => Promise<Result>;
  onDelete: (id: string) => Promise<Result>;
  savedMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const toRows = (list: NameValueItem[]): Row[] =>
    list.map((i) => ({
      key: i.id,
      id: i.id,
      name: i.name,
      value: String(i.value),
    }));

  function openModal() {
    setRows(toRows(items)); // lo último del servidor
    setOpen(true);
  }

  const set = (key: string, field: "name" | "value", v: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: v } : r)));

  async function save() {
    const clean = rows.filter((r) => r.name.trim());
    const bad = clean.find(
      (r) => r.value.trim() === "" || !(Number(r.value) >= 0),
    );
    if (bad)
      return toast(`Revisá el número de "${bad.name.trim()}".`, "danger");
    setBusy(true);
    try {
      const keptIds = new Set(clean.filter((r) => r.id).map((r) => r.id));
      const removed = items.filter((i) => !keptIds.has(i.id));
      // Solo se manda lo que cambió (editar un precio toca todos sus carretes).
      const changed = clean.filter((r) => {
        const before = items.find((i) => i.id === r.id);
        return (
          !before ||
          before.name !== r.name.trim() ||
          before.value !== Number(r.value)
        );
      });
      for (const r of changed) {
        const res = await onSave(r.id ?? null, {
          name: r.name.trim(),
          value: Number(r.value),
        });
        if (!res.ok) return toast(res.error.message, "danger");
      }
      for (const i of removed) {
        const res = await onDelete(i.id);
        if (!res.ok) return toast(res.error.message, "danger");
      }
      toast(savedMessage, "success");
      setOpen(false);
    } catch {
      toast("No se pudo guardar. Probá de nuevo.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={openModal}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-4">
          <p className="text-faint text-[12.5px] leading-relaxed">{intro}</p>
          <div className="flex flex-col gap-2">
            {rows.length === 0 ? (
              <p className="text-dim text-sm">Todavía no hay ninguno.</p>
            ) : null}
            {rows.map((r) => {
              const note = items.find((i) => i.id === r.id)?.note;
              return (
                <div key={r.key} className="flex flex-wrap items-center gap-2">
                  <input
                    className="input"
                    style={{ flex: "1 1 160px", minWidth: 0 }}
                    placeholder={namePlaceholder}
                    aria-label="Nombre"
                    maxLength={60}
                    value={r.name}
                    onChange={(e) => set(r.key, "name", e.target.value)}
                  />
                  <input
                    className="input"
                    style={{ width: 110 }}
                    type="number"
                    min={0}
                    aria-label={valueLabel}
                    placeholder={valueLabel}
                    value={r.value}
                    onChange={(e) => set(r.key, "value", e.target.value)}
                  />
                  <span className="text-faint text-[12px]">{valueSuffix}</span>
                  {note ? (
                    <span className="text-faint text-[11.5px]">· {note}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn-icon btn-ghost"
                    title="Quitar"
                    aria-label={`Quitar ${r.name || "fila"}`}
                    onClick={() =>
                      setRows((rs) => rs.filter((x) => x.key !== r.key))
                    }
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm self-start"
            onClick={() =>
              setRows((rs) => [...rs, { key: newKey(), name: "", value: "" }])
            }
          >
            ＋ {addLabel}
          </button>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={save} loading={busy}>
              Guardar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
