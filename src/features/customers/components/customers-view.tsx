"use client";

import Link from "next/link";
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
        <div className="grid-3">
          {customers.map((c) => (
            <Link
              key={`${c.source}-${c.id}`}
              href={`/admin/clientes/${c.id}`}
              className="ui-card card-hover block"
              style={{ padding: 18 }}
            >
              <div className="mb-3.5 flex items-center gap-3">
                <span
                  className="avatar flex-shrink-0"
                  style={{ width: 46, height: 46, fontSize: 17 }}
                >
                  {(c.name[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-faint text-[12px]">{c.city ?? "—"}</div>
                </div>
                <span className={`badge ${TIER_BADGE_CLASS[c.tier]}`}>
                  {TIER_LABEL[c.tier]}
                </span>
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
              <div className="text-faint mt-3 text-[11.5px]">
                Cliente desde {sinceFmt.format(c.since)}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="ui-card section-card" style={{ padding: 0 }}>
          <div className="flex flex-col">
            {customers.map((c, i) => (
              <Link
                key={`${c.source}-${c.id}`}
                href={`/admin/clientes/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]"
                style={{
                  borderTop: i === 0 ? "none" : "1px solid var(--border)",
                }}
              >
                <span
                  className="avatar flex-shrink-0"
                  style={{ width: 38, height: 38, fontSize: 15 }}
                >
                  {(c.name[0] ?? "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">
                    {c.name}
                  </div>
                  <div className="text-faint text-[12px]">{c.city ?? "—"}</div>
                </div>
                <span
                  className={`badge ${TIER_BADGE_CLASS[c.tier]} hidden sm:inline-flex`}
                >
                  {TIER_LABEL[c.tier]}
                </span>
                <div className="text-dim w-16 text-right text-[13px]">
                  {c.orders} ped.
                </div>
                <div
                  className="w-24 text-right text-[13px] font-semibold"
                  style={{ color: "var(--gold-bright)" }}
                >
                  {compactPrice(c.spent)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
