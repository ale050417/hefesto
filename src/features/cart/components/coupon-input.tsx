"use client";

import { useEffect, useRef, useState } from "react";
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
  const autoTried = useRef(false);

  async function applyCode(c: string) {
    if (!c.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await runAction(
      () => validateCouponAction(c.trim(), subtotal),
      {
        silent: true,
      },
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
  const apply = () => applyCode(code);

  // Link directo: si la URL trae ?cupon=CODE, lo aplica solo (una vez que el
  // carrito cargó su subtotal). Así se comparte un link con el cupón puesto.
  useEffect(() => {
    if (autoTried.current || applied || subtotal <= 0) return;
    const c = new URLSearchParams(window.location.search).get("cupon");
    if (!c) return;
    autoTried.current = true;
    const t = setTimeout(() => void applyCode(c.trim().toUpperCase()), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, applied]);

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
