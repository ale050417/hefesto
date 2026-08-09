"use client";

import { useEffect } from "react";
import { useCartStore } from "@/stores/cartStore";
import { useInquiryStore } from "@/stores/inquiryStore";
import { useUiStore } from "@/stores/uiStore";
import { useWishlistStore } from "@/features/wishlist/store";
import { COMPRADO_KEY, SOLO_KEY } from "@/features/cart/selection";
import { decidirSesion, OWNER_KEY } from "../sessionScope";

/**
 * Borra TODO lo que el navegador guarda del cliente: carrito, cupón, favoritos,
 * paneles abiertos y las señales del checkout.
 *
 * Se exporta porque la usan dos caminos: el botón de "Cerrar sesión" (limpia
 * ANTES de irse, sin depender de ningún caché) y este guardián (red de
 * seguridad para la sesión vencida o para otra persona que entra después).
 */
export function limpiarEstadoLocal(): void {
  useCartStore.getState().clear(); // ítems + cupón
  useInquiryStore.getState().clear(); // lista de consulta (vidriera digital)
  useWishlistStore.getState().setIds([]);
  useUiStore.getState().closeCart();
  useUiStore.getState().closeInquiry();
  useUiStore.getState().closeFav();
  try {
    sessionStorage.removeItem(COMPRADO_KEY);
    sessionStorage.removeItem(SOLO_KEY);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* sin storage: no hay señales que borrar */
  }
}

/**
 * Ata el estado guardado en el navegador a la sesión.
 *
 * El carrito se persiste en localStorage para que no se pierda al recargar,
 * pero eso también hacía que sobreviviera al "Cerrar sesión": el siguiente que
 * entraba en la misma computadora veía el carrito del anterior. Acá se compara
 * quién navega ahora contra el dueño guardado y, si no es el mismo, se limpia
 * todo lo local.
 *
 * Va en el layout de la tienda, así corre en cualquier pantalla: no depende de
 * que el cierre de sesión se haga desde el botón (también cubre la sesión
 * vencida o cerrada desde otra pestaña).
 */
export function SessionGuard({
  userId,
}: {
  /** `undefined` = no se pudo verificar la sesión (no se toca nada). */
  userId: string | null | undefined;
}) {
  useEffect(() => {
    if (userId === undefined) return;

    let dueño: string | null = null;
    try {
      dueño = localStorage.getItem(OWNER_KEY);
    } catch {
      return; // sin storage no hay nada que limpiar
    }

    const accion = decidirSesion(dueño, userId);
    if (accion === "nada") return;
    if (accion === "limpiar") limpiarEstadoLocal();

    try {
      if (userId) localStorage.setItem(OWNER_KEY, userId);
      else localStorage.removeItem(OWNER_KEY);
    } catch {
      /* no se pudo marcar el dueño: se reintenta en la próxima carga */
    }
  }, [userId]);

  return null;
}
