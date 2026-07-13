import * as repo from "./repository";
import { computePointsEarned } from "./points";
import type { RewardInput } from "./schemas";

export type Reward = repo.Reward;

export async function getBalance(customerId: string): Promise<number> {
  return repo.getBalance(customerId);
}

export async function getReward(id: string): Promise<Reward | null> {
  return repo.findRewardById(id);
}

/** Gasta puntos (canje). Registra un movimiento NEGATIVO en el ledger. */
export async function spendPoints(
  customerId: string,
  points: number,
  reason: string,
): Promise<void> {
  await repo.addTransaction({ customerId, delta: -points, reason });
}

/** Devuelve puntos (reverso si el canje falla después de descontar). */
export async function refundPoints(
  customerId: string,
  points: number,
  reason: string,
): Promise<void> {
  await repo.addTransaction({ customerId, delta: points, reason });
}

export async function getHistory(customerId: string) {
  return repo.listTransactions(customerId);
}

/* ===================== Catálogo de recompensas (admin) ===================== */

function toRewardValues(input: RewardInput) {
  const isDiscount = input.type === "discount";
  const isProduct = input.type === "product";
  return {
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    costPoints: input.costPoints,
    discountValue:
      isDiscount && input.discountValue != null
        ? String(input.discountValue)
        : null,
    discountIsPercent: isDiscount ? (input.discountIsPercent ?? false) : false,
    productId: isProduct ? (input.productId ?? null) : null,
    isActive: input.isActive ?? true,
  };
}

export async function listRewards(): Promise<Reward[]> {
  return repo.listRewards();
}

export async function getRewardsStats() {
  return repo.getPointsStats();
}

export async function createReward(input: RewardInput): Promise<Reward> {
  return repo.insertReward(toRewardValues(input));
}

export async function updateReward(
  id: string,
  input: RewardInput,
): Promise<Reward> {
  return repo.updateRewardRow(id, toRewardValues(input));
}

export async function deleteReward(id: string): Promise<void> {
  return repo.deleteRewardRow(id);
}

export type PointsSummary = {
  balance: number;
  earned: number;
  redeemed: number;
  redemptions: {
    id: string;
    reason: string;
    points: number;
    createdAt: Date;
  }[];
};

/** Resumen para el panel: saldo, acumulados, canjeados y lista de canjes. */
export async function getPointsSummary(
  customerId: string,
): Promise<PointsSummary> {
  const txns = await repo.listTransactions(customerId, 200);
  let earned = 0;
  let redeemed = 0;
  const redemptions: PointsSummary["redemptions"] = [];
  for (const t of txns) {
    if (t.delta >= 0) {
      earned += t.delta;
    } else {
      redeemed += -t.delta;
      redemptions.push({
        id: t.id,
        reason: t.reason,
        points: -t.delta,
        createdAt: t.createdAt,
      });
    }
  }
  return { balance: earned - redeemed, earned, redeemed, redemptions };
}

// Violación de unique de Postgres (código 23505).
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "23505"
  );
}

/**
 * Otorga puntos por un pedido pagado. Idempotente en DOS capas: el chequeo
 * previo (rápido) y el índice único parcial `point_transactions(order_id)
 * WHERE delta > 0` (migración 0033), que hace imposible duplicar bajo
 * concurrencia (webhook y confirmación manual a la vez). Si otro proceso
 * acreditó primero, el insert choca con el unique y se ignora.
 */
export async function awardForOrder(params: {
  customerId: string;
  orderId: string;
  orderTotal: number;
}): Promise<void> {
  const already = await repo.hasOrderAward(params.orderId);
  if (already) return;
  const points = computePointsEarned(params.orderTotal);
  if (points <= 0) return;
  try {
    await repo.addTransaction({
      customerId: params.customerId,
      orderId: params.orderId,
      delta: points,
      reason: "Compra",
    });
  } catch (error) {
    if (isUniqueViolation(error)) return; // ya acreditado por otro proceso
    throw error;
  }
}
