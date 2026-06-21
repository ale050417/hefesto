"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { registerFailureAction } from "../actions";
import type { FilamentView } from "../types";

type Values = {
  filamentId: string;
  pieceName: string;
  gramsLost: number;
  reason: string;
  notes: string;
  deducted: boolean;
};

export function FailureForm({ filaments }: { filaments: FilamentView[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      filamentId: "",
      pieceName: "",
      gramsLost: 0,
      reason: "",
      notes: "",
      deducted: true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErr(null);
    setMsg(null);
    const res = await registerFailureAction(values);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    reset();
    setMsg(
      res.data.lowStock
        ? "Falla registrada. ⚠️ El filamento quedó bajo el umbral de stock."
        : "Falla registrada.",
    );
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="ui-card space-y-3 p-5">
      <h2 className="text-fg font-display text-base">Registrar falla</h2>
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-dim mb-1 block text-xs">Filamento</label>
          <select className="select" {...register("filamentId")}>
            <option value="">Elegí…</option>
            {filaments.map((f) => (
              <option key={f.id} value={f.id}>
                {f.material} · {f.color} ({f.stockGrams} g)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Pieza</label>
          <input className="input" {...register("pieceName")} />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Gramos perdidos</label>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("gramsLost", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Causa</label>
          <input
            className="input"
            placeholder="Warping, despegue..."
            {...register("reason")}
          />
        </div>
      </div>
      <div>
        <label className="text-dim mb-1 block text-xs">Notas (opcional)</label>
        <textarea className="textarea" rows={2} {...register("notes")} />
      </div>
      <label className="text-dim flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-[var(--gold)]"
          {...register("deducted")}
        />
        Descontar del stock del filamento
      </label>
      <Button type="submit" disabled={isSubmitting}>
        Registrar
      </Button>
    </form>
  );
}
