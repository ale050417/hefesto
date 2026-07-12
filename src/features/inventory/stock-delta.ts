/**
 * Logica pura del descuento de stock con tope en 0 (sin tocar la DB). El
 * repository aplica exactamente esto dentro de la transaccion; separarlo aca lo
 * hace testeable (Cap. 15) para ventas y fallas por igual.
 *
 *  - `newStock` = GREATEST(stock + delta, 0): nunca baja de 0.
 *  - `appliedDelta` = lo REAL que se movio (pedia -80 con 50 -> -50).
 *  - `atThreshold` = tras una BAJA quedo en/bajo el umbral de alerta.
 *  - `shortfall` = se pidio MAS de lo que habia (stock + delta < 0): falta
 *    filamento y conviene COMPRAR.
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
  const wouldBe = current + delta;
  const newStock = Math.max(0, wouldBe);
  const down = delta < 0;
  return {
    newStock,
    appliedDelta: newStock - current,
    atThreshold: down && newStock <= threshold,
    shortfall: down && wouldBe < 0,
  };
}
