"use client";

import { useEffect } from "react";
import { getMyWishlistIdsAction } from "../actions";
import { useWishlistStore } from "../store";

// Carga los favoritos del usuario una vez (montado en el layout del storefront).
export function WishlistLoader() {
  const setIds = useWishlistStore((s) => s.setIds);
  useEffect(() => {
    let active = true;
    getMyWishlistIdsAction().then((ids) => {
      if (active) setIds(ids);
    });
    return () => {
      active = false;
    };
  }, [setIds]);
  return null;
}
