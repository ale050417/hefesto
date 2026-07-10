"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toggleCouponAction } from "../actions";
import { runAction } from "@/lib/run-action";

export function CouponToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await runAction(() => toggleCouponAction(id, !isActive), { silent: true });
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title="Cambiar estado"
    >
      <Badge variant={isActive ? "success" : "neutral"}>
        {isActive ? "Activo" : "Inactivo"}
      </Badge>
    </button>
  );
}
