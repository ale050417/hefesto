import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listFilamentsView } from "@/features/inventory/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Filamentos" };

export default async function FilamentosPage() {
  const filaments = await listFilamentsView();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventario</div>
          <h1 className="page-title">Filamentos</h1>
          <div className="page-sub">{filaments.length} en stock</div>
        </div>
        <Link
          href="/admin/filamentos/nuevo"
          className={buttonVariants({ size: "sm" })}
        >
          Nuevo filamento
        </Link>
      </div>

      {filaments.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          Todavía no cargaste filamentos.
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Color</th>
                  <th className="text-right">Stock (g)</th>
                  <th className="text-right">Umbral (g)</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filaments.map((f) => (
                  <tr key={f.id}>
                    <td className="text-fg">{f.material}</td>
                    <td className="text-dim">{f.color}</td>
                    <td className="text-fg text-right">{f.stockGrams}</td>
                    <td className="text-dim text-right">
                      {f.alertThresholdGrams}
                    </td>
                    <td>
                      {f.lowStock ? (
                        <Badge variant="warning">Bajo stock</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/filamentos/${f.id}/editar`}
                        className="text-primary hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
