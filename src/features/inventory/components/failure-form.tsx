"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { registerFailureAction, updateFailureAction } from "../actions";
import { runAction } from "@/lib/run-action";
import {
  FAIL_REASONS,
  FILAMENT_COLORS,
  FILAMENT_MATERIALS,
} from "../constants";

export type FailureFormData = {
  id?: string;
  pieceName: string;
  material: string;
  color: string;
  gramsLost: number;
  reason: string;
  notes: string | null;
};

/** Carrete real del inventario para elegir en el descuento (modo alta). */
export type FailureFilament = {
  id: string;
  material: string;
  color: string;
  stockGrams: number;
};

export function FailureForm({
  failure,
  materials,
  filaments = [],
  onDone,
  onCancel,
}: {
  failure?: FailureFormData;
  /** Materiales presentes en inventario (fallback: catalogo completo). */
  materials?: string[];
  /** Carretes del inventario (para el descuento multicolor en el alta). */
  filaments?: FailureFilament[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const edit = !!failure?.id;
  const matOptions =
    materials && materials.length > 0 ? materials : FILAMENT_MATERIALS;

  // Comunes
  const [pieceName, setPieceName] = useState(failure?.pieceName ?? "");
  const [reason, setReason] = useState(failure?.reason ?? FAIL_REASONS[0]!);
  const [notes, setNotes] = useState(failure?.notes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edicion (un color, no toca stock - igual que antes)
  const [material, setMaterial] = useState(
    failure?.material ?? matOptions[0] ?? "PLA",
  );
  const [color, setColor] = useState(failure?.color ?? "Negro");
  const [gramsLost, setGramsLost] = useState(
    failure ? String(failure.gramsLost) : "",
  );

  // Alta multicolor: una linea por carrete (mismo patron que la venta manual)
  const [colorLines, setColorLines] = useState<
    Array<{ filamentId: string; grams: string }>
  >([{ filamentId: "", grams: "" }]);
  const [deduct, setDeduct] = useState(true);

  const setColorLine = (i: number, k: "filamentId" | "grams", v: string) =>
    setColorLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const addColorLine = () =>
    setColorLines((ls) => [...ls, { filamentId: "", grams: "" }]);
  const removeColorLine = (i: number) =>
    setColorLines((ls) => (ls.length <= 1 ? ls : ls.filter((_, j) => j !== i)));
  const colorGramsTotal = colorLines.reduce(
    (a, l) => a + (Number(l.grams) || 0),
    0,
  );

  async function submitCreate() {
    setErr(null);
    if (!pieceName.trim()) return setErr("Ingresa la pieza / producto.");
    const valid = colorLines.filter((l) => l.filamentId && Number(l.grams) > 0);
    if (valid.length === 0) {
      return setErr(
        "Elegi al menos un carrete y los gramos perdidos (se descuentan del stock).",
      );
    }
    const primary = filaments.find((f) => f.id === valid[0]!.filamentId);
    setBusy(true);
    const payload = {
      pieceName: pieceName.trim(),
      material: primary?.material ?? material,
      color: primary?.color ?? color,
      gramsLost: valid.reduce((a, l) => a + Number(l.grams), 0),
      reason,
      notes: notes.trim() || undefined,
      deducted: deduct,
      colorLines: valid.map((l) => ({
        filamentId: l.filamentId,
        grams: Number(l.grams),
      })),
    };
    try {
      const res = await runAction(() => registerFailureAction(payload), {
        silent: true,
      });
      if (!res.ok) return setErr(res.error.message);
      toast("Falla registrada", "success");
      onDone?.();
    } catch {
      setErr("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    setErr(null);
    if (!(Number(gramsLost) > 0)) return setErr("Ingresa los gramos perdidos.");
    setBusy(true);
    const payload = {
      pieceName,
      material,
      color,
      gramsLost: Number(gramsLost),
      reason,
      notes: notes.trim() || undefined,
    };
    try {
      const res = await runAction(
        () => updateFailureAction(failure!.id!, payload),
        { silent: true },
      );
      if (!res.ok) return setErr(res.error.message);
      toast("Falla actualizada", "success");
      onDone?.();
    } catch {
      setErr("No se pudo guardar. Intenta de nuevo.");
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

      <div className="field">
        <label htmlFor="fa-piece">Pieza / producto</label>
        <input
          id="fa-piece"
          className="input"
          placeholder="Ej: Lampara Lunar"
          value={pieceName}
          onChange={(e) => setPieceName(e.target.value)}
        />
      </div>

      {edit ? (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="fa-mat">Material</label>
            <select
              id="fa-mat"
              className="select"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
            >
              {matOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fa-color">Color</label>
            <select
              id="fa-color"
              className="select"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              {FILAMENT_COLORS.map((c) => (
                <option key={c.n} value={c.n}>
                  {c.n}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="field">
          <label>Colores perdidos (descuenta stock)</label>
          <p className="text-faint text-[12px] leading-relaxed">
            Elegi el/los carrete(s) y cuantos gramos se perdieron de cada uno.
            Se descuenta de cada carrete; si a alguno no le alcanza, la falla se
            registra igual y te avisamos por notificacion para reponer.
          </p>
          {colorLines.map((ln, i) => (
            <div key={i} className="mt-2 flex items-center gap-2">
              <select
                className="select flex-1"
                value={ln.filamentId}
                onChange={(e) => setColorLine(i, "filamentId", e.target.value)}
              >
                <option value="">- Elegi carrete -</option>
                {filaments.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.material} - {f.color} ({f.stockGrams} g)
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ width: 100 }}
                type="number"
                min={0}
                placeholder="gramos"
                value={ln.grams}
                onChange={(e) => setColorLine(i, "grams", e.target.value)}
              />
              <span className="text-faint text-[12px]">g</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={() => removeColorLine(i)}
                aria-label="Quitar carrete"
              >
                x
              </button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={addColorLine}
            >
              + Agregar color
            </button>
            <span className="text-faint ml-auto text-[12px]">
              Total perdido: {colorGramsTotal} g
            </span>
          </div>
        </div>
      )}

      <div className={edit ? "grid-2" : "field"}>
        {edit ? (
          <div className="field">
            <label htmlFor="fa-grams">Gramos perdidos</label>
            <input
              id="fa-grams"
              type="number"
              className="input"
              placeholder="0"
              value={gramsLost}
              onChange={(e) => setGramsLost(e.target.value)}
            />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="fa-reason">Causa</label>
          <select
            id="fa-reason"
            className="select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {FAIL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="fa-notes">
          Notas <span className="text-faint font-normal">(opcional)</span>
        </label>
        <textarea
          id="fa-notes"
          className="textarea"
          placeholder="Que paso..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {edit ? null : (
        <div
          className="ui-card flex items-center justify-between"
          style={{ padding: "13px 15px" }}
        >
          <div>
            <div className="text-[13.5px] font-semibold">
              Descontar del stock
            </div>
            <div className="text-faint text-[12px]">
              Resta los gramos de cada carrete elegido
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={deduct}
            aria-label="Descontar del stock"
            className={`switch ${deduct ? "on" : ""}`}
            onClick={() => setDeduct((d) => !d)}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={edit ? submitEdit : submitCreate}
          loading={busy}
        >
          {busy ? "Guardando..." : edit ? "Guardar" : "Registrar falla"}
        </Button>
      </div>
    </div>
  );
}
