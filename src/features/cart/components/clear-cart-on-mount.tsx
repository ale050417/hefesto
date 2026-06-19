"use client";

import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";

// Vacía el carrito al montar. Se usa en la pantalla de éxito: así el carrito se
// limpia recién cuando el pedido ya se concretó (no antes de pagar en MP).
export function ClearCartOnMount() {
  const clear = useCartStore((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
