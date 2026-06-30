"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { registerFailureAction, updateFailureAction } from "../actions";
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

export function FailureForm({
  failure,
  materials,
  onDone,
  onCancel,
}: {
  failure?: FailureFormData;
  /** Materiales presentes en inventario (fallback: catálogo completo). */
  materials?: string[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const edit = !!failure?.id;
  const matOptions =
    materials && materials.length > 0 ? materials : FILAMENT_MATERIALS;
  const [form, setForm] = useState({
    pieceName: failure?.pieceName ?? "",
    material: failure?.material ?? matOptions[0] ?? "PLA",
    color: failure?.color ?? "Negro",
    gramsLost: failure ? String(failure.gramsLost) : "",
    reason: failure?.reason ?? FAIL_REASONS[0]!,
    notes: failure?.notes ?? "",
  });
  const [deduct, setDeduct] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    if (!(Number(form.gramsLost) > 0)) {
      return setErr("Ingresá los gramos perdidos");
    }
    setBusy(true);
    const payload = { ...form, deducted: edit ? undefined : deduct };
    if (edit && failure?.id) {
      const res = await updateFailureAction(failure.id, payload);
      setBusy(false);
      if (!res.ok) return setErr(res.error.message);
      toast("Falla actualizada", "success");
    } else {
      const res = await registerFailureAction(payload);
      setBusy(false);
      if (!res.ok) return setErr(res.error.message);
      if (res.data && !res.data.deducted && deduct) {
        toast(
          "Falla registrada (no se encontró un filamento de ese material/color para descontar).",
          "default",
        );
      } else {
        toast("Falla registrada", "success");
      }
    }
    onDone?.();
    router.refresh();
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
          placeholder="Ej: Lámpara Lunar"
          value={form.pieceName}
          onChange={(e) => set("pieceName", e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fa-mat">Material</label>
          <select
            id="fa-mat"
            className="select"
            value={form.material}
            onChange={(e) => set("material", e.target.value)}
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
            value={form.color}
            onChange={(e) => set("color", e.target.value)}
          >
            {FILAMENT_COLORS.map((c) => (
              <option key={c.n} value={c.n}>
                {c.n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="fa-grams">Gramos perdidos</label>
          <input
            id="fa-grams"
            type="number"
            className="input"
            placeholder="0"
            value={form.gramsLost}
            onChange={(e) => set("gramsLost", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="fa-reason">Causa</label>
          <select
            id="fa-reason"
            className="select"
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
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
          placeholder="Qué pasó..."
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
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
              Resta los gramos del filamento
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
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Registrar falla"}
        </Button>
      </div>
    </div>
  );
}
