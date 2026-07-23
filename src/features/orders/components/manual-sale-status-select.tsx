"use client";

import { OrderStateControl } from "./order-state-control";
import type { OrderStatus } from "../types";
import { updateManualSaleStatusAction } from "../actions";
import { runAction } from "@/lib/run-action";

/**
 * Selector inline del estado de una venta manual. Usa el control compartido
 * (respeta la máquina de estados, badge fijo si es terminal, pide motivo al
 * cancelar/reembolsar). La action re-valida en el servidor.
 */
export function ManualSaleStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  return (
    <OrderStateControl
      status={status}
      ariaLabel="Estado de la venta"
      onTransition={async (next, reason) => {
        const res = await runAction(
          () => updateManualSaleStatusAction(id, next, reason ?? undefined),
          { silent: true },
        );
        return res.ok ? { ok: true } : { ok: false, error: res.error.message };
      }}
    />
  );
}
