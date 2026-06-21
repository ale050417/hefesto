"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { saveFilamentAction } from "../actions";

type Values = {
  material: string;
  color: string;
  stockGrams: number;
  alertThresholdGrams: number;
};

export function FilamentForm({
  id,
  defaults,
}: {
  id?: string;
  defaults?: Partial<Values>;
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      material: defaults?.material ?? "",
      color: defaults?.color ?? "",
      stockGrams: defaults?.stockGrams ?? 0,
      alertThresholdGrams: defaults?.alertThresholdGrams ?? 0,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErr(null);
    const res = await saveFilamentAction(values, id);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    router.push("/admin/filamentos");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="ui-card max-w-lg space-y-3 p-5">
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-dim mb-1 block text-xs">Material</label>
          <input
            className="input"
            placeholder="PLA, PETG..."
            {...register("material")}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Color</label>
          <input
            className="input"
            placeholder="Negro, Dorado..."
            {...register("color")}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Stock (g)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("stockGrams", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">
            Umbral de alerta (g)
          </label>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("alertThresholdGrams", { valueAsNumber: true })}
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
