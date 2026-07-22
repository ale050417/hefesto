"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIER_BADGE_CLASS, TIER_LABEL } from "../tier";
import type { AdminCustomer } from "../service";
import { compactPrice } from "@/lib/format";

const sinceFmt = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  year: "numeric",
});

export function CustomersView({ customers }: { customers: AdminCustomer[] }) {
  const [view, setView] = useState<"grilla" | "lista">("grilla");
  const router = useRouter();

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <div className="mode-switch">
          <button
            className={view === "grilla" ? "active" : ""}
            onClick={() => setView("grilla")}
            title="Grilla"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            className={view === "lista" ? "active" : ""}
            onClick={() => setView("lista")}
            title="Lista"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {view === "grilla" ? (
        <div
          className="grid gap-3.5"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          }}
        >
          {customers.map((c) => (
            <Link
              key={`${c.source}-${c.id}`}
              href={`/admin/clientes/${c.id}`}
              className="ui-card card-hover block"
              style={{ padding: 24 }}
            >
              <div className="mb-3.5 flex items-center gap-3">
                <span
                  className="avatar flex-shrink-0"
                  style={{ width: 58, height: 58, fontSize: 22 }}
                >
                  {(c.name[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-faint truncate text-[12px]">
                    {c.phone || c.email || c.city || "Sin contacto"}
                  </div>
                </div>
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="ui-card text-center" style={{ padding: 11 }}>
                  <div className="kpi-val" style={{ fontSize: 20 }}>
                    {c.orders}
                  </div>
                  <div className="text-faint text-[11px]">pedidos</div>
                </div>
                <div className="ui-card text-center" style={{ padding: 11 }}>
                  <div
                    className="kpi-val"
                    style={{ fontSize: 20, color: "var(--gold-bright)" }}
                  >
                    {compactPrice(c.spent)}
                  </div>
                  <div className="text-faint text-[11px]">gastado</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-faint text-[11.5px]">
                  Cliente desde {sinceFmt.format(c.since)}
                </span>
                <span className={`badge ${TIER_BADGE_CLASS[c.tier]}`}>
                  {TIER_LABEL[c.tier]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div
          className="ui-card section-card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div className="table-wrap" style={{ border: "none" }}>
            {/* Lista estándar: tabla con encabezados en desktop; en móvil se
                apila como tarjetas (.tbl-cards). Fila clickeable → ficha. */}
            <table className="tbl tbl-cards">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Ciudad</th>
                  <th>Nivel</th>
                  <th>Pedidos</th>
                  <th>Gastado</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={`${c.source}-${c.id}`}
                    onClick={() => router.push(`/admin/clientes/${c.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td data-label="Cliente">
                      <div className="flex items-center gap-3">
                        <span
                          className="avatar flex-shrink-0"
                          style={{ width: 34, height: 34, fontSize: 13 }}
                        >
                          {(c.name[0] ?? "?").toUpperCase()}
                        </span>
                        <b>{c.name}</b>
                      </div>
                    </td>
                    <td className="muted" data-label="Ciudad">
                      {c.city ?? "—"}
                    </td>
                    <td data-label="Nivel">
                      <span className={`badge ${TIER_BADGE_CLASS[c.tier]}`}>
                        {TIER_LABEL[c.tier]}
                      </span>
                    </td>
                    <td data-label="Pedidos">{c.orders} ped.</td>
                    <td
                      className="price"
                      data-label="Gastado"
                      style={{ color: "var(--gold-bright)", fontWeight: 700 }}
                    >
                      {compactPrice(c.spent)}
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
