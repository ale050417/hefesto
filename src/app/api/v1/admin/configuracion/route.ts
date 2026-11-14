import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { loadConfigSnapshot } from "@/features/settings/api-load";

/**
 * GET /api/v1/admin/configuracion — toda la configuración de la tienda para la
 * app (2026-10-31): negocio, envíos y retiro, medios de pago, apariencia
 * (con banners y logo para mostrar) y textos clave. Permiso config/ver, el
 * mismo que la página web. El Access Token de MercadoPago NUNCA viaja: solo
 * `pagos.mpConnected`. El equipo y los roles van aparte (`/equipo`).
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/configuracion", async (request: Request) => {
  const auth = await requireApiPerm(request, "config", "ver");
  if ("response" in auth) return auth.response;
  return apiOk(await loadConfigSnapshot());
});
