import { formatPrice } from "@/lib/format";
import type { ConsumptionRow } from "../service";

/**
 * Consumo de filamento del año: gramos usados y costo asociado.
 *  - "ventas": consumo REAL del ledger de movimientos (pedidos online y
 *    ventas manuales descuentan stock desde 2026-07; neto de reposiciones).
 *  - "fallas": gramos perdidos reales registrados en Fallas.
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
        Consumo real descontado del inventario por ventas (tienda y manuales) +
        pérdidas registradas en fallas.
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
