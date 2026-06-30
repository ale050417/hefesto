import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";

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

      <div className="ui-card max-w-2xl p-6">
        <p className="text-dim text-sm leading-relaxed">
          la funcion esta en construcción.
        </p>
        <ul className="text-dim mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>
            <b className="text-fg">Dependencia para Excel (.xlsx):</b>
          </li>
        </ul>
      </div>
    </div>
  );
}
