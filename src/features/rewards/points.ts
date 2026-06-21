// Reglas del programa de puntos (módulo puro, sin DB ni I/O).

// 1 punto por cada $100 de compra.
export const POINTS_PER_AMOUNT = 100;
// 1 punto equivale a $1 al canjear.
export const MONEY_PER_POINT = 1;

export function computePointsEarned(orderTotal: number): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return 0;
  return Math.floor(orderTotal / POINTS_PER_AMOUNT);
}

export function pointsToMoney(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor(points) * MONEY_PER_POINT;
}

export function canRedeem(balance: number, points: number): boolean {
  return Number.isInteger(points) && points > 0 && points <= balance;
}
