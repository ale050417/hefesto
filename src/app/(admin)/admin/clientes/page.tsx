import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listAdminCustomers } from "@/features/customers/service";
import { TIER_BADGE_CLASS, TIER_LABEL } from "@/features/customers/tier";
import { CustomerSearch } from "@/features/customers/components/customer-search";
import { NuevoClienteButton } from "@/features/customers/components/nuevo-cliente-button";
import { compactPrice, formatPrice } from "@/lib/format";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clientes" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x && x !== "" ? x : undefined;
}

const sinceFmt = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  year: "numeric",
});

export default async function ClientesAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermissionPage("clientes", "ver");
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").toLowerCase();

  // Carga acotada: si la base se traba, la página avisa con datos parciales
  // en vez de colgarse hasta el 504 (ver lib/safe-load, 2026-07-11).
  const allR = await safeLoad("clientes", listAdminCustomers(), []);
  const all = allR.value;
  const list = q
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      )
    : all;

  const totalSpent = all.reduce((a, c) => a + c.spent, 0);

  return (
    <div className="view grid gap-5">
      <DegradedNotice sources={allR.ok ? [] : ["la lista de clientes"]} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Relaciones</div>
          <h1 className="page-title">Clientes</h1>
          <div className="page-sub">
            {all.length} clientes · {formatPrice(totalSpent)} en compras totales
          </div>
        </div>
        <NuevoClienteButton />
      </div>

      <div className="toolbar">
        <CustomerSearch />
      </div>

      {list.length === 0 ? (
        <div className="ui-card section-card flex flex-col items-center gap-2 p-10 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width={26}
            height={26}
            aria-hidden
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="text-dim">No se encontraron clientes.</div>
        </div>
      ) : (
        <div className="grid-3">
          {list.map((c) => (
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
      )}
    </div>
  );
}
