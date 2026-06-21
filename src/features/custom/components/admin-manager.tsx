"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import {
  quoteCustomRequestAction,
  transitionCustomRequestAction,
} from "../actions";
import { CUSTOM_STATUS_LABEL, CUSTOM_TRANSITIONS } from "../transitions";
import type { CustomRequest } from "../types";

export function AdminManager({ request }: { request: CustomRequest }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const next = CUSTOM_TRANSITIONS[request.status];

  async function quote(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await quoteCustomRequestAction(request.id, { amount });
    setPending(false);
    if (res.ok) {
      toast("Cotización enviada al cliente.", "success");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  async function move(to: CustomRequest["status"]) {
    setPending(true);
    const res = await transitionCustomRequestAction(request.id, to);
    setPending(false);
    if (res.ok) {
      toast(`Estado: ${CUSTOM_STATUS_LABEL[to]}`, "success");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <div className="ui-card grid gap-4 p-5">
      {request.status === "pending" ? (
        <form onSubmit={quote} className="grid gap-2">
          <label
            className="text-dim mb-1 block text-xs font-medium"
            htmlFor="amount"
          >
            Cotizar (ARS)
          </label>
          <div className="flex gap-2">
            <input
              id="amount"
              type="number"
              min="1"
              step="0.01"
              className="input flex-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" disabled={pending}>
              Enviar cotización
            </Button>
          </div>
        </form>
      ) : null}

      {next.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-dim text-xs">Cambiar estado:</span>
          {next
            .filter((s) => !(request.status === "pending" && s === "quoted"))
            .map((s) => (
              <Button
                key={s}
                variant={s === "rejected" ? "ghost" : "secondary"}
                size="sm"
                onClick={() => move(s)}
                disabled={pending}
              >
                {CUSTOM_STATUS_LABEL[s]}
              </Button>
            ))}
        </div>
      ) : null}
    </div>
  );
}
