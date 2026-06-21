"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { approveQuoteAction } from "../actions";

export function ApproveQuote({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function accept() {
    setPending(true);
    const res = await approveQuoteAction(requestId);
    setPending(false);
    if (res.ok) {
      toast("¡Cotización aceptada! Coordinamos el pago.", "success");
      router.refresh();
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
