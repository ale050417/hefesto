"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCan } from "@/components/auth/perms-provider";
import { runAction } from "@/lib/run-action";
import { toast } from "@/stores/toastStore";
import { createPresetLikeAction } from "../actions";
import type { MarginPresetOption } from "../service";

export type CreatedPreset = { id: string; name: string; marginPct?: number };

/**
 * "＋ Nuevo tipo" al lado del selector "Tipo de producto" (sugerencia de
 * Agustín, 2026-11-25: poder crear más tipos sin pedírselos a Ale). Quien
 * cotiza no ve márgenes, así que no carga un %: le pone nombre y elige un tipo
 * que ya existe; el nuevo se cobra igual. Ale recibe un aviso y lo ajusta
 * después si hace falta.
 */
export function NewPresetInline({
  options,
  onCreated,
}: {
  /** Tipos activos: de uno de estos se copia el margen. */
  options: MarginPresetOption[];
  onCreated: (preset: CreatedPreset) => void;
}) {
  const allowed = useCan("calculadora", "crear");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [likeId, setLikeId] = useState("");
  const [busy, setBusy] = useState(false);

  if (!allowed || options.length === 0) return null;

  async function create() {
    if (!name.trim()) return toast("Ponele un nombre al tipo.", "danger");
    if (!likeId) return toast("Elegí con qué tipo se cobra igual.", "danger");
    setBusy(true);
    const res = await runAction(
      () => createPresetLikeAction({ name, likePresetId: likeId }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast(`Tipo "${res.data.name}" creado`, "success");
    onCreated(res.data);
    setName("");
    setLikeId("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm self-start"
        onClick={() => setOpen(true)}
      >
        ＋ Nuevo tipo
      </button>
    );
  }

  return (
    <div
      className="ui-card flex flex-col gap-3"
      style={{ padding: "12px 14px" }}
    >
      <div className="field">
        <label htmlFor="np-name">Nombre del tipo nuevo</label>
        <input
          id="np-name"
          className="input"
          maxLength={120}
          placeholder="Ej: Trofeos con placa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="np-like">Se cobra como</label>
        <select
          id="np-like"
          className="select"
          value={likeId}
          onChange={(e) => setLikeId(e.target.value)}
        >
          <option value="">Elegí un tipo que ya existe…</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="text-faint text-[11.5px] leading-relaxed">
          El tipo nuevo se cobra igual que el que elijas. Le llega un aviso a
          Ale, que lo puede ajustar después.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen(false)}
        >
          Cancelar
        </Button>
        <Button type="button" onClick={create} loading={busy}>
          Crear tipo
        </Button>
      </div>
    </div>
  );
}
