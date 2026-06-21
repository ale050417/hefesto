"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { saveCouponAction } from "../actions";

type Values = {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minPurchase: number;
  maxUses: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

export function CouponForm({
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
      code: defaults?.code ?? "",
      type: defaults?.type ?? "percentage",
      value: defaults?.value ?? 0,
      minPurchase: defaults?.minPurchase ?? 0,
      maxUses: defaults?.maxUses ?? "",
      startsAt: defaults?.startsAt ?? "",
      expiresAt: defaults?.expiresAt ?? "",
      isActive: defaults?.isActive ?? true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setErr(null);
    const res = await saveCouponAction(values, id);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    router.push("/admin/descuentos");
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
          <label className="text-dim mb-1 block text-xs">Código</label>
          <input className="input uppercase" {...register("code")} />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Tipo</label>
          <select className="select" {...register("type")}>
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Valor</label>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("value", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">Compra mínima</label>
          <input
            type="number"
            step="0.01"
            className="input"
            {...register("minPurchase", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">
            Máx. usos (vacío = ilimitado)
          </label>
          <input type="number" className="input" {...register("maxUses")} />
        </div>
        <div className="flex items-end">
          <label className="text-dim flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--gold)]"
              {...register("isActive")}
            />
            Activo
          </label>
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">
            Desde (opcional)
          </label>
          <input
            type="datetime-local"
            className="input"
            {...register("startsAt")}
          />
        </div>
        <div>
          <label className="text-dim mb-1 block text-xs">
            Hasta (opcional)
          </label>
          <input
            type="datetime-local"
            className="input"
            {...register("expiresAt")}
          />
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
