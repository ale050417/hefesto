import type { ReactNode } from "react";
import { requireStaff } from "@/core/auth/session";
import { getAllPerms } from "@/core/auth/permissions";
import { getBrandSettings } from "@/features/settings/service";
import { PermsProvider } from "@/components/auth/perms-provider";
import { AdminShell } from "@/components/layout/admin-shell";

// Tope de ejecución del render del panel. Sin esto, un request que se
// cuelga esperando conexión a la DB podía retenerla hasta 300 s (default de
// la plataforma) y agravar el agotamiento del pool. 30 s corta rápido.
export const maxDuration = 30;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Candado 2: autorización por rol (admin/operador) en el servidor.
  await requireStaff();
  // Permisos completos (ver/crear/editar/eliminar por módulo), en UNA pasada.
  // Para el sidebar (filtra por "ver") y para el contexto de la UI.
  // El logo del negocio (Config → Negocio) es el MISMO que muestra la tienda.
  const [allPerms, brand] = await Promise.all([
    getAllPerms(),
    getBrandSettings().catch(() => null),
  ]);
  const verMap = Object.fromEntries(
    Object.entries(allPerms).map(([k, v]) => [k, v.ver]),
  );
  return (
    <PermsProvider value={allPerms}>
      <AdminShell perms={verMap} logoUrl={brand?.logoUrl ?? null}>
        {children}
      </AdminShell>
    </PermsProvider>
  );
}
