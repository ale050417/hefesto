"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { toggleCouponAction } from "../actions";

export function CouponToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await toggleCouponAction(id, !isActive);
    setBusy(false);
    router.refresh();
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
