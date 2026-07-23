"use client";

import { OrderStateControl } from "./order-state-control";
import type { OrderStatus } from "../types";
import { transitionOrderAction } from "../actions";
import { runAction } from "@/lib/run-action";

/**
 * Selector inline del estado de un pedido ONLINE, directo desde la tabla. Usa el
 * control compartido (respeta la máquina de estados, badge fijo si es terminal,
 * pide motivo al cancelar/reembolsar). La action valida el permiso y la máquina.
 */
export function OrderStatusSelect({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  return (
    <OrderStateControl
      status={status}
      ariaLabel="Estado del pedido"
      onTransition={async (next, reason) => {
        const res = await runAction(
          () => transitionOrderAction(id, next, reason ?? undefined),
          { silent: true },
        );
        return res.ok ? { ok: true } : { ok: false, error: res.error.message };
      }}
    />
  );
}
