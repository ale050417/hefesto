import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}
