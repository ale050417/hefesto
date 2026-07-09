import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { ImportSales } from "@/features/orders/components/import-sales";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar ventas" };

export default async function ImportarVentasPage() {
  await requirePermissionPage("pedidos", "crear");

  return (
    <div>
      <Link href="/admin/pedidos" className="text-dim hover:text-fg text-sm">
        ← Volver a pedidos
      </Link>
      <div className="page-head mt-2">
        <div>
          <div className="eyebrow">Operación</div>
          <h1 className="page-title">Importar Excel/CSV</h1>
          <div className="page-sub">
            Carga masiva de ventas desde una planilla
          </div>
        </div>
      </div>

      <ImportSales />
    </div>
  );
}
