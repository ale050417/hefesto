"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { approveQuoteAction } from "../actions";
import { runAction } from "@/lib/run-action";

export function ApproveQuote({ requestId }: { requestId: string }) {
  const [pending, setPending] = useState(false);
  async function accept() {
    setPending(true);
    const res = await runAction(() => approveQuoteAction(requestId), {
      silent: true,
    });
    setPending(false);
    if (res.ok) {
      toast("¡Cotización aceptada! Coordinamos el pago.", "success");
    } else {
      toast(res.error.message, "danger");
    }
  }
  return (
    <Button variant="primary" onClick={accept} disabled={pending}>
      {pending ? "Procesando…" : "Aceptar cotización"}
    </Button>
  );
}
