"use client";

import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";

/** Misma clave que escribe el checkout al confirmar. */
const COMPRADO_KEY = "hefesto-comprado";

/**
 * Limpia el carrito al llegar a la pantalla de éxito — pero SOLO las líneas que
 * se compraron.
 *
 * Desde que el checkout deja elegir con tildes qué llevar ahora, vaciar el
 * carrito entero borraba lo que el cliente había dejado a propósito para
 * después (pedido de Ale, 2026-08-03). El checkout guarda las líneas compradas
 * en sessionStorage y acá se quitan una por una.
 *
 * Si no hay lista (pedido viejo, otra pestaña, modo incógnito sin storage) se
 * vacía todo, que es el comportamiento anterior: nunca dejamos el carrito con
 * cosas ya pagadas.
 */
export function ClearCartOnMount() {
  const clear = useCartStore((s) => s.clear);
  const removeItem = useCartStore((s) => s.removeItem);
  const setCoupon = useCartStore((s) => s.setCoupon);

  useEffect(() => {
    let comprados: string[] | null = null;
    try {
      const raw = sessionStorage.getItem(COMPRADO_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed))
          comprados = parsed.filter((x): x is string => typeof x === "string");
      }
      sessionStorage.removeItem(COMPRADO_KEY);
    } catch {
      /* sin storage: caemos al vaciado completo */
    }

    if (!comprados || comprados.length === 0) {
      clear();
      return;
    }
    for (const key of comprados) {
      const [productId = "", variantId = "", color = ""] = key.split("|");
      removeItem(productId, variantId || null, color || null);
    }
    // El cupón se consumió en este pedido: no puede quedar aplicado al resto.
    setCoupon(null);
  }, [clear, removeItem, setCoupon]);

  return null;
}
