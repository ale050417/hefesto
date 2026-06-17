import type { ReactNode } from "react";
import { requireStaff } from "@/core/auth/session";
import { Sidebar } from "@/components/layout/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Candado 2: autorización por rol (admin/operador) en el servidor.
  await requireStaff();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
