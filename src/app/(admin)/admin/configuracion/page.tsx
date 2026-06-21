import { requireStaff } from "@/core/auth/session";
import { getBusinessSettings } from "@/features/settings/service";
import { BusinessInfoForm } from "@/features/settings/components/business-info-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración — Admin" };

export default async function AdminSettingsPage() {
  await requireStaff();
  const settings = await getBusinessSettings();

  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Negocio</div>
          <h1 className="page-title">Configuración</h1>
        </div>
      </div>
      <p className="text-dim max-w-prose text-sm">
        Datos de contacto y redes. El WhatsApp se usa en el botón flotante y el
        resto aparece en el pie de página.
      </p>
      <BusinessInfoForm settings={settings} />
    </div>
  );
}
