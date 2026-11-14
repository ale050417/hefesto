"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { saveTrustBarAction } from "../actions";
import {
  DEFAULT_TRUST_BAR as DEFAULTS,
  TRUST_ICON_LABEL as LABELS,
  type TrustItem,
} from "../trust-defaults";

export function TrustBarEditor({
  initial,
  onSaved,
  bare = false,
}: {
  initial: TrustItem[] | null;
  onSaved?: () => void;
  /** Sin la tarjeta/título propios (los pone el contenedor SectionCard). */
  bare?: boolean;
}) {
  const [items, setItems] = useState<TrustItem[]>(
    initial && initial.length > 0 ? initial : DEFAULTS,
  );
  const [busy, setBusy] = useState(false);

  const set = (i: number, k: "t" | "d", v: string) =>
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  async function save() {
    setBusy(true);
    const res = await runAction(() => saveTrustBarAction({ items }), {
      silent: true,
    });
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Banda de confianza guardada", "success");
    onSaved?.();
  }

  const inner = (
    <>
      <p className="text-faint text-[12.5px] leading-relaxed">
        Editá el título y el texto de cada uno de los 4 puntos; el ícono queda
        fijo.
      </p>
      {items.map((it, i) => (
        <div
          key={i}
          className="ui-card flex flex-col gap-2"
          style={{ padding: 14 }}
        >
          <div className="text-faint text-[11px] font-semibold tracking-wide uppercase">
            {LABELS[it.ic] ?? `Punto ${i + 1}`}
          </div>
          <input
            className="input"
            placeholder="Título (ej. Producción en 48 h)"
            value={it.t}
            maxLength={60}
            onChange={(e) => set(i, "t", e.target.value)}
          />
          <input
            className="input"
            placeholder="Texto (ej. Imprimimos y despachamos rápido)"
            value={it.d}
            maxLength={140}
            onChange={(e) => set(i, "d", e.target.value)}
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button type="button" onClick={save} loading={busy}>
          Guardar banda
        </Button>
      </div>
    </>
  );

  if (bare) return <div className="flex flex-col gap-4">{inner}</div>;

  return (
    <div className="ui-card section-card flex flex-col gap-4">
      <div>
        <h2 className="section-title">Banda de confianza</h2>
      </div>
      {inner}
    </div>
  );
}
