"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { validateCouponAction } from "@/features/discounts/actions";
import { formatPrice } from "@/lib/format";
import { selectSubtotal, useCartStore } from "@/stores/cartStore";
import { runAction } from "@/lib/run-action";

export function CouponInput() {
  const subtotal = useCartStore(selectSubtotal);
  const applied = useCartStore((s) => s.appliedCoupon);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await runAction(
      () => validateCouponAction(code.trim(), subtotal),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) {
      // El action del carrito usa error:string; las fallas sintetizadas, objeto.
      setErr(typeof res.error === "string" ? res.error : res.error.message);
      return;
    }
    setCoupon({ code: res.code, discount: res.discount });
    setCode("");
  }

  if (applied) {
    return (
      <div className="bg-success/10 flex items-center justify-between rounded-md px-3 py-2 text-sm">
        <span className="text-success">
          Cupón <b>{applied.code}</b> · −{formatPrice(applied.discount)}
        </span>
        <button
          type="button"
          onClick={() => setCoupon(null)}
          className="text-dim hover:text-fg text-xs"
        >
          Quitar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de cupón"
          className="border-surface-3 bg-surface-2 text-fg flex-1 rounded-md border px-3 py-2 text-sm uppercase"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={apply}
        >
          Aplicar
        </Button>
      </div>
      {err ? <p className="text-danger text-xs">{err}</p> : null}
    </div>
  );
}
