import { FailureForm } from "@/features/inventory/components/failure-form";
import { listFailures, listFilamentsView } from "@/features/inventory/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fallas" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "short" });

export default async function FallasPage() {
  const [filaments, failures] = await Promise.all([
    listFilamentsView(),
    listFailures(),
  ]);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventario</div>
          <h1 className="page-title">Fallas de impresión</h1>
        </div>
      </div>

      <FailureForm filaments={filaments} />

      {failures.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          Todavía no registraste fallas.
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pieza</th>
                  <th>Filamento</th>
                  <th className="text-right">Gramos</th>
                  <th>Causa</th>
                  <th>Descontado</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.id}>
                    <td className="text-dim whitespace-nowrap">
                      {dateFmt.format(f.createdAt)}
                    </td>
                    <td className="text-fg">{f.pieceName}</td>
                    <td className="text-dim">
                      {f.material} · {f.color}
                    </td>
                    <td className="text-fg text-right">
                      {Number(f.gramsLost)}
                    </td>
                    <td className="text-dim">{f.reason}</td>
                    <td className="text-dim">{f.deducted ? "Sí" : "No"}</td>
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
