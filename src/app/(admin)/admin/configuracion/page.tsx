import { requirePermissionPage } from "@/core/auth/permissions";
import {
  getAllBanners,
  getBusinessSettings,
  getPaymentSettings,
  getShippingSettings,
  listRoles,
  listTeam,
} from "@/features/settings/service";
import { ConfigTabs } from "@/features/settings/components/config-tabs";
import { loadOrThrow } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  const user = await requirePermissionPage("config", "ver");
  // Carga etiquetada y con deadline: error claro + log [admin:configuración]
  // en vez de un cuelgue de 30 s si la DB no responde (2026-07-11).
  const [settings, payment, shipping, banners, team, roles] = await loadOrThrow(
    "configuración",
    Promise.all([
      getBusinessSettings(),
      getPaymentSettings(),
      getShippingSettings(),
      getAllBanners(),
      listTeam(),
      listRoles(),
    ]),
  );
  // SEGURIDAD: el Access Token de MercadoPago NUNCA se manda al cliente. Al form
  // solo le pasamos si está conectado; el token queda server-side.
  const mpConnected = Boolean(payment?.mpAccessToken?.trim());
  const paymentSafe = payment ? { ...payment, mpAccessToken: null } : null;

  return (
    <div className="view grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Sistema</div>
          <h1 className="page-title">Configuración</h1>
          <div className="page-sub">
            Datos del negocio, pagos, tienda y roles
          </div>
        </div>
      </div>
      <ConfigTabs
        settings={settings}
        payment={paymentSafe}
        mpConnected={mpConnected}
        shipping={shipping}
        banners={banners}
        team={team}
        roles={roles}
        currentUserId={user.id}
        canManageRoles={user.profile?.role === "admin"}
      />
    </div>
  );
}
