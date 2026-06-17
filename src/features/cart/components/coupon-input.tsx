"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CouponInput() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de cupón"
          className="border-surface-3 bg-surface-2 text-fg flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMsg("Los cupones llegan en la Fase 8.")}
        >
          Aplicar
        </Button>
      </div>
      {msg ? <p className="text-faint text-xs">{msg}</p> : null}
    </div>
  );
}
