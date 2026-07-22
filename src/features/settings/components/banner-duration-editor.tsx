"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { saveBannerIntervalAction } from "../actions";

// Rango recomendado: ni tan rápido que no se llegue a leer, ni tan lento que
// aburra. El servidor valida lo mismo (3-12 s).
const MIN = 3;
const MAX = 12;

export function BannerDurationEditor({
  initial,
  onSaved,
  bare = false,
}: {
  initial: number | null;
  onSaved?: () => void;
  bare?: boolean;
}) {
  const [sec, setSec] = useState<number>(
    initial && initial >= MIN && initial <= MAX ? initial : 5,
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await runAction(
      () => saveBannerIntervalAction({ seconds: sec }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) return toast(res.error.message, "danger");
    toast("Duración de banners guardada", "success");
    onSaved?.();
  }

  const inner = (
    <>
      <p className="text-faint text-[12.5px] leading-relaxed">
        Segundos que se muestra cada banner antes de pasar al siguiente.
        Recomendado entre {MIN} y {MAX} segundos.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="number"
          className="input"
          style={{ maxWidth: 110 }}
          min={MIN}
          max={MAX}
          value={sec}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value) || MIN);
            setSec(Math.min(MAX, Math.max(MIN, n)));
          }}
        />
        <span className="text-faint text-[12.5px]">
          segundos ({MIN}–{MAX})
        </span>
        <div className="ml-auto">
          <Button type="button" onClick={save} loading={busy}>
            Guardar duración
          </Button>
        </div>
      </div>
    </>
  );

  if (bare) return <div className="flex flex-col gap-2">{inner}</div>;

  return (
    <div className="ui-card section-card flex flex-col gap-3">
      <div>
        <h2 className="section-title">Duración de los banners</h2>
      </div>
      {inner}
    </div>
  );
}
