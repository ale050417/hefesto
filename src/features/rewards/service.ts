import * as repo from "./repository";
import { computePointsEarned } from "./points";

export async function getBalance(customerId: string): Promise<number> {
  return repo.getBalance(customerId);
}

export async function getHistory(customerId: string) {
  return repo.listTransactions(customerId);
}

// Otorga puntos por un pedido pagado. Idempotente: no duplica si ya se otorgó.
export async function awardForOrder(params: {
  customerId: string;
  orderId: string;
  orderTotal: number;
}): Promise<void> {
  const already = await repo.hasOrderAward(params.orderId);
  if (already) return;
  const points = computePointsEarned(params.orderTotal);
  if (points <= 0) return;
  await repo.addTransaction({
    customerId: params.customerId,
    orderId: params.orderId,
    delta: points,
    reason: "Compra",
  });
}
