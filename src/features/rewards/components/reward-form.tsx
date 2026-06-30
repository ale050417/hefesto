"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { createRewardAction, updateRewardAction } from "../actions";
import { REWARD_TYPES, type RewardTypeKey } from "../reward-types";

export type RewardFormData = {
  id?: string;
  type: RewardTypeKey;
  title: string;
  description: string | null;
  costPoints: number;
  discountValue: number | null;
  discountIsPercent: boolean;
  productId: string | null;
  isActive: boolean;
};

export type ProductOption = { id: string; name: string };

export function RewardForm({
  reward,
  products,
  onDone,
  onCancel,
}: {
  reward?: RewardFormData;
  products: ProductOption[];
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const edit = !!reward?.id;
  const [type, setType] = useState<RewardTypeKey>(reward?.type ?? "discount");
  const [form, setForm] = useState({
    title: reward?.title ?? "",
    costPoints: reward ? String(reward.costPoints) : "",
    description: reward?.description ?? "",
    discountValue:
      reward?.discountValue != null ? String(reward.discountValue) : "",
    discountIsPercent: reward?.discountIsPercent ?? false,
    productId: reward?.productId ?? products[0]?.id ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    if (!form.title.trim()) return setErr("Ingresá un título");
    if (!(Number(form.costPoints) > 0))
      return setErr("Ingresá el costo en puntos");
    setBusy(true);
    const payload = {
      type,
      title: form.title,
      description: form.description,
      costPoints: form.costPoints,
      discountValue: type === "discount" ? form.discountValue : "",
      discountIsPercent: type === "discount" ? form.discountIsPercent : false,
      productId: type === "product" ? form.productId : "",
      isActive: reward?.isActive ?? true,
    };
    const res =
      edit && reward?.id
        ? await updateRewardAction(reward.id, payload)
        : await createRewardAction(payload);
    setBusy(false);
    if (!res.ok) return setErr(res.error.message);
    toast(edit ? "Recompensa actualizada" : "Recompensa creada", "success");
    onDone?.();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="field">
        <label>Tipo de recompensa</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(REWARD_TYPES) as RewardTypeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${type === k ? "active" : ""}`}
              onClick={() => setType(k)}
            >
              {REWARD_TYPES[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="rw-title">Título</label>
          <input
            id="rw-title"
            className="input"
            placeholder="Ej: $2.000 de descuento"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rw-cost">Costo en puntos</label>
          <input
            id="rw-cost"
            type="number"
            className="input"
            placeholder="500"
            value={form.costPoints}
            onChange={(e) => set("costPoints", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="rw-desc">Descripción</label>
        <input
          id="rw-desc"
          className="input"
          placeholder="Cupón aplicable a cualquier pedido"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {type === "discount" ? (
        <div className="field">
          <label htmlFor="rw-value">Valor del descuento</label>
          <div className="flex gap-2">
            <input
              id="rw-value"
              type="number"
              className="input"
              placeholder="2000"
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
            />
            <select
              className="select"
              style={{ width: 130 }}
              value={form.discountIsPercent ? "pct" : "ars"}
              onChange={(e) =>
                set("discountIsPercent", e.target.value === "pct")
              }
            >
              <option value="ars">$ pesos</option>
              <option value="pct">% porcentaje</option>
            </select>
          </div>
        </div>
      ) : type === "product" ? (
        <div className="field">
          <label htmlFor="rw-product">Producto de regalo</label>
          <select
            id="rw-product"
            className="select"
            value={form.productId}
            onChange={(e) => set("productId", e.target.value)}
          >
            {products.length === 0 ? (
              <option value="">No hay productos publicados</option>
            ) : (
              products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>
      ) : (
        <div className="text-faint py-2 text-[12.5px]">
          Genera un beneficio de envío gratis al canjearse.
        </div>
      )}

      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={busy}>
          {busy ? "Guardando…" : edit ? "Guardar" : "Crear recompensa"}
        </Button>
      </div>
    </div>
  );
}
