import type { ReactNode } from "react";
import { requireStaff } from "@/core/auth/session";
import { getAllPerms } from "@/core/auth/permissions";
import { PermsProvider } from "@/components/auth/perms-provider";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Candado 2: autorización por rol (admin/operador) en el servidor.
  await requireStaff();
  // Permisos completos (ver/crear/editar/eliminar por módulo), en UNA pasada.
  // Para el sidebar (filtra por "ver") y para el contexto de la UI.
  const allPerms = await getAllPerms();
  const verMap = Object.fromEntries(
    Object.entries(allPerms).map(([k, v]) => [k, v.ver]),
  );
  return (
    <PermsProvider value={allPerms}>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Sidebar perms={verMap} />
        <main id="main" className="admin-content">
          {children}
        </main>
      </div>
    </PermsProvider>
  );
}
