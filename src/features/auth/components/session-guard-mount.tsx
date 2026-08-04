import { cookies } from "next/headers";
import { getCurrentUser } from "@/core/auth/session";
import { WishlistLoader } from "@/features/wishlist/components/wishlist-loader";
import { SessionGuard } from "./session-guard";

/**
 * Resuelve de quién es la sesión y monta el guardián.
 *
 * Va en su propio componente async (dentro de un Suspense) para no frenar el
 * render del layout: si el layout entero esperara a `getCurrentUser`, el Header
 * y la página dejarían de armarse en paralelo y se le sumaría latencia a cada
 * pantalla.
 *
 * `undefined` = "no pudimos verificar la sesión": hay cookie de Supabase pero no
 * se resolvió el usuario (servicio caído, token sin refrescar). Ahí el guardián
 * NO limpia nada; borrarle el carrito a alguien que sigue logueado por una
 * caída ajena sería peor que el problema que esto resuelve.
 */
export async function SessionGuardMount() {
  const [user, jar] = await Promise.all([getCurrentUser(), cookies()]);
  const hayCookieDeSesion = jar
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const userId = user?.id ?? (hayCookieDeSesion ? undefined : null);

  return (
    <>
      <SessionGuard userId={userId} />
      {/* Los favoritos también son de esta sesión: se recargan cuando cambia
          el usuario, incluso si el login no recargó la página. */}
      <WishlistLoader userId={userId} />
    </>
  );
}
