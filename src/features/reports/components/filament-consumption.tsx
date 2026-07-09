import { formatPrice } from "@/lib/format";
import type { ConsumptionRow } from "../service";

/**
 * Consumo de filamento del año (Fase 5): gramos usados y costo asociado.
 *  - "ventas": estimado por peso del producto × unidades vendidas en tienda.
 *  - "fallas": gramos perdidos reales registrados en Fallas.
 * Las ventas manuales no guardan gramos, por eso no se estiman (se aclara).
 */
export function FilamentConsumption({ rows }: { rows: ConsumptionRow[] }) {
  const totalGrams = rows.reduce((acc, r) => acc + r.grams, 0);
  const totalCost = rows.reduce((acc, r) => acc + r.cost, 0);
  const fmtG = (g: number) =>
    g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`;

  return (
    <div className="ui-card section-card">
      <div className="section-title mb-1">Consumo de filamento</div>
      <div className="text-faint mb-4 text-[12.5px]">
        Estimado por ventas de tienda (peso × unidades) + pérdidas reales por
        fallas. Las ventas manuales no registran gramos.
      </div>
      {rows.length === 0 ? (
        <p className="text-dim py-6 text-center text-sm">
          Sin consumo registrado en el período.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-4">
            <div>
              <div className="text-faint text-[11.5px]">Total usado</div>
              <b className="text-[16px]">{fmtG(totalGrams)}</b>
            </div>
            <div>
              <div className="text-faint text-[11.5px]">Costo asociado</div>
              <b className="price text-[16px]" style={{ color: "var(--gold)" }}>
                {formatPrice(totalCost)}
              </b>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div
                key={`${r.source}-${r.material}-${r.color ?? ""}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--surface-3,#eee)] pb-2 text-[13px] last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="chip"
                    style={{
                      fontSize: 11,
                      background:
                        r.source === "fallas"
                          ? "rgba(var(--danger-rgb), .12)"
                          : "rgba(var(--success-rgb), .12)",
                      color:
                        r.source === "fallas"
                          ? "var(--danger)"
                          : "var(--success)",
                    }}
                  >
                    {r.source === "fallas" ? "Falla" : "Ventas"}
                  </span>
                  <span className="text-fg font-medium">{r.material}</span>
                  {r.color ? (
                    <span className="text-faint text-[12px]">{r.color}</span>
                  ) : null}
                </div>
                <div className="text-dim flex items-center gap-4">
                  <span>{fmtG(r.grams)}</span>
                  <span className="w-24 text-right">{formatPrice(r.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
