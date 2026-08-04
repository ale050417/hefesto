"use client";

import { useRouter } from "next/navigation";
import { useCartStore, type CartItem } from "@/stores/cartStore";
import { toast } from "@/stores/toastStore";
import { guardarComprarSolo, lineKey } from "./selection";

type NuevoItem = Omit<CartItem, "quantity">;

/**
 * Las dos formas de comprar, iguales en toda la tienda (tarjeta del catálogo,
 * modal de opciones y página del producto).
 *
 * Agregar solo AVISA ("Agregado al carrito") y suma el contador de arriba: no
 * abre ningún panel. Antes se desplegaba un cuadro con los últimos productos
 * del carrito y era confuso — el cliente tocaba "agregar" y le aparecían cosas
 * que no había pedido (Ale, 2026-08-04). El carrito se ve cuando el cliente
 * toca el carrito.
 *
 * "Comprar ahora" deja una señal con la línea elegida: el checkout la lee y
 * destilda el resto, así el que tocó UN producto no paga lo que tenía guardado.
 */
export function useCartActions() {
  const addItem = useCartStore((s) => s.addItem);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const router = useRouter();

  const agregar = (item: NuevoItem, qty = 1) => {
    addItem(item, qty);
    toast(`${item.name} agregado al carrito`, "success");
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
