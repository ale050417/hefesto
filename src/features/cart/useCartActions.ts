"use client";

import { useRouter } from "next/navigation";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { useUiStore } from "@/stores/uiStore";
import { guardarComprarSolo, lineKey } from "./selection";

type NuevoItem = Omit<CartItem, "quantity">;

/**
 * Las dos formas de comprar, iguales en toda la tienda (tarjeta del catálogo,
 * modal de opciones y página del producto).
 *
 * "Comprar ahora" deja una señal con la línea elegida: el checkout la lee y
 * destilda el resto del carrito, así el cliente que tocó UN producto no termina
 * pagando lo que había guardado la semana pasada (decisión de Ale, 2026-08-04).
 * No se borra nada: lo demás queda en el carrito.
 */
export function useCartActions() {
  const addItem = useCartStore((s) => s.addItem);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const flashCart = useUiStore((s) => s.flashCart);
  const router = useRouter();

  const agregar = (item: NuevoItem, qty = 1) => {
    addItem(item, qty);
    flashCart();
  };

  const comprarAhora = (item: NuevoItem, qty = 1) => {
    addItem(item, qty);
    // FIJA la cantidad, no la acumula: si esa línea ya estaba en el carrito (o
    // el cliente toca dos veces mientras carga la página), "Comprar ahora" de 1
    // unidad terminaba cobrando 2 — y encima el checkout muestra solo ese
    // producto, así que nadie lo notaba.
    setQuantity(item.productId, item.variantId, qty, item.color);
    guardarComprarSolo(lineKey(item));
    router.push("/checkout");
  };

  return { agregar, comprarAhora };
}
