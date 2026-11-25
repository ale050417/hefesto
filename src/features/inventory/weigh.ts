import { ValidationError } from "@/core/errors";

/**
 * "Calcular filamento" (pedido de Agustín, 2026-11-24): se pesa el carrete en
 * uso y se le resta lo que pesa VACÍO ese modelo de carrete. Antes había que
 * buscar un carrete vacío igual, pesar los dos y restar a mano.
 *
 * Puro (sin base): lo usan el servidor para confirmar y la pantalla para
 * mostrar el resultado mientras se tipea.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export type WeighPlan = {
  /** Filamento que queda en el carrete pesado. */
  remainingGrams: number;
  /** Stock total del color: lo pesado + los carretes cerrados aparte. */
  newStockGrams: number;
};

export function planWeigh(input: {
  /** Peso del carrete con el filamento que le queda. */
  totalGrams: number;
  /** Peso del carrete vacío (del modelo elegido). */
  emptyGrams: number;
  /** Carretes cerrados del mismo color, que se suman enteros. */
  sealedSpools?: number;
  /** Gramos de filamento de un carrete nuevo de este color. */
  spoolGrams: number;
}): WeighPlan {
  const { totalGrams, emptyGrams } = input;
  if (!Number.isFinite(totalGrams) || totalGrams <= 0) {
    throw new ValidationError("Ingresá cuánto pesa el carrete.");
  }
  if (totalGrams < emptyGrams) {
    throw new ValidationError(
      `El carrete pesa ${r2(totalGrams)} g y vacío pesa ${r2(emptyGrams)} g: revisá el peso o el modelo de carrete.`,
    );
  }
  const remainingGrams = r2(totalGrams - emptyGrams);
  const sealed = Math.max(0, Math.floor(input.sealedSpools ?? 0));
  return {
    remainingGrams,
    newStockGrams: r2(remainingGrams + sealed * input.spoolGrams),
  };
}
