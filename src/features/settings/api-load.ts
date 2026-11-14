import { DEFAULT_QUOTE_DEFAULTS } from "@/features/quotes/build-quote";
import { getQuoteDefaults } from "@/features/quotes/service";
import type { ApiUser } from "@/core/auth/api-auth";
import { buildConfigSnapshot, buildTeamSnapshot } from "./api-serialize";
import { getSettingsStrict, listBanners } from "./repository";
import * as repo from "./repository";
import { listRoles, listTeam } from "./service";

/**
 * Lecturas de Configuración para la API de la app (2026-10-31). Frescas (sin
 * caché de 60 s: el dueño tiene que ver lo que acaba de guardar) y ESTRICTAS:
 * si la base no responde lanzan, así la app muestra "reintentar" en vez de un
 * formulario vacío que se podría guardar encima de los datos reales.
 */
export async function loadConfigSnapshot() {
  const [settings, payment, shipping, banners, quote] = await Promise.all([
    getSettingsStrict(),
    repo.getPaymentSettings(),
    repo.getShippingSettings(),
    listBanners(),
    // Los textos de la cotización son accesorios: si fallan, van los de fábrica.
    getQuoteDefaults().catch(() => DEFAULT_QUOTE_DEFAULTS),
  ]);
  return buildConfigSnapshot({ settings, payment, shipping, banners, quote });
}

export async function loadTeamSnapshot(user: ApiUser) {
  const [team, roles] = await Promise.all([listTeam(), listRoles()]);
  return buildTeamSnapshot({
    team,
    roles,
    currentUserId: user.id,
    canManage: user.profile?.role === "admin",
  });
}
