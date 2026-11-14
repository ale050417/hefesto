import { MONEY_PER_POINT, POINTS_PER_AMOUNT } from "./points";
import { REWARD_TYPES } from "./reward-types";
import type { RewardInput } from "./schemas";
import type { Reward } from "./service";

/**
 * Forma JSON de las recompensas para la app móvil
 * (`/api/v1/admin/recompensas`). Módulo puro (sin DB).
 */

export function rewardToJson(
  r: Reward,
  productNames: ReadonlyMap<string, string> = new Map(),
) {
  return {
    id: r.id,
    type: r.type,
    typeLabel: REWARD_TYPES[r.type].label,
    title: r.title,
    description: r.description,
    costPoints: r.costPoints,
    discountValue: r.discountValue != null ? Number(r.discountValue) : null,
    discountIsPercent: r.discountIsPercent,
    productId: r.productId,
    productName: r.productId ? (productNames.get(r.productId) ?? null) : null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Reglas de coherencia que el formulario web no chequea pero la app sí (una
 * recompensa de descuento sin valor, o de producto sin producto, no se puede
 * canjear: el cupón se crearía con valor 0). Devuelve el mensaje o null.
 */
export function rewardInputProblem(input: RewardInput): string | null {
  if (input.type === "discount" && !(Number(input.discountValue) > 0)) {
    return "Ingresá el valor del descuento.";
  }
  if (input.type === "product" && !input.productId) {
    return "Elegí el producto de regalo.";
  }
  return null;
}

/** Catálogo ordenado como lo muestra el panel web: de menor a mayor costo. */
export function sortRewards(list: Reward[]): Reward[] {
  return [...list].sort((a, b) => a.costPoints - b.costPoints);
}

/** Reglas del programa de puntos (constantes de `points.ts`, no editables). */
export function programInfo() {
  return {
    pointsPerAmount: POINTS_PER_AMOUNT,
    moneyPerPoint: MONEY_PER_POINT,
  };
}

export function redemptionToJson(r: {
  id: string;
  customerId: string;
  customerName: string | null;
  reason: string;
  points: number;
  createdAt: Date;
}) {
  return {
    id: r.id,
    customerId: r.customerId,
    customerName: r.customerName,
    reason: r.reason,
    points: r.points,
    createdAt: r.createdAt.toISOString(),
  };
}
