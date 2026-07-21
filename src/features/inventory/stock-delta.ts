/**
 * Logica pura del descuento de stock (sin tocar la DB). El repository aplica
 * exactamente esto dentro de la transaccion; separarlo aca lo hace testeable
 * (Cap. 15) para ventas y fallas por igual.
 *
 * El stock PUEDE ir a NEGATIVO (sobreventa/backorder, decision 2026-07): si se
 * vende sin stock de un color, queda en negativo y al REPONER filamento se
 * compensa solo el deficit (mantiene el orden). Por eso ya NO se topa en 0.
 *
 *  - `newStock` = stock + delta (puede ser negativo).
 *  - `appliedDelta` = el delta completo (siempre se aplica entero).
 *  - `atThreshold` = tras una BAJA quedo en/bajo el umbral de alerta.
 *  - `shortfall` = quedo NEGATIVO: se debe MAS de lo que hay, conviene COMPRAR.
 */
export function resolveStockDelta(
  current: number,
  delta: number,
  threshold: number,
): {
  newStock: number;
  appliedDelta: number;
  atThreshold: boolean;
  shortfall: boolean;
} {
  const newStock = current + delta;
  const down = delta < 0;
  return {
    newStock,
    appliedDelta: delta,
    atThreshold: down && newStock <= threshold,
    shortfall: down && newStock < 0,
  };
}
