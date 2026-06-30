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

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  const user = await requirePermissionPage("config", "ver");
  const [settings, payment, shipping, banners, team, roles] = await Promise.all(
    [
      getBusinessSettings(),
      getPaymentSettings(),
      getShippingSettings(),
      getAllBanners(),
      listTeam(),
      listRoles(),
    ],
  );

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
        payment={payment}
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
