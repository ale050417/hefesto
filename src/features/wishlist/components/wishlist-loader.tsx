"use client";

import { useEffect } from "react";
import { getMyWishlistIdsAction } from "../actions";
import { useWishlistStore } from "../store";

/**
 * Carga los favoritos del usuario (montado en el layout del storefront).
 *
 * Depende de `userId` a propósito: al iniciar sesión sin recargar la página el
 * layout no se vuelve a montar, así que antes el recién logueado quedaba con la
 * lista vacía, veía todos los corazones apagados y, al tocar uno que YA tenía
 * guardado, el toggle se lo BORRABA.
 *
 * `undefined` = no se pudo verificar la sesión: se deja lo que haya.
 */
export function WishlistLoader({
  userId,
}: {
  userId: string | null | undefined;
}) {
  const setIds = useWishlistStore((s) => s.setIds);
  useEffect(() => {
    if (userId === undefined) return;
    let active = true;
    getMyWishlistIdsAction()
      .then((ids) => {
        if (active) setIds(ids);
      })
      .catch((e: unknown) => {
        // Sin catch quedaba una promesa rechazada suelta. Los favoritos son
        // secundarios: se anota el error y la tienda sigue funcionando.
        console.error("[favoritos] no se pudieron cargar", e);
      });
    return () => {
      active = false;
    };
  }, [setIds, userId]);
  return null;
}
