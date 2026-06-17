import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * true en el cliente, false en el servidor — sin setState en efecto.
 * Sirve para evitar mismatches de hidratación con estado persistido.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
