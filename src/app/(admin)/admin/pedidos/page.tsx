import Link from "next/link";
import { requirePermissionPage } from "@/core/auth/permissions";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_METHOD_LABEL,
} from "@/features/orders/constants";
import {
  getOrderStatusCounts,
  listOrdersAdmin,
} from "@/features/orders/services/orderAdminService";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import { listProfitShares } from "@/features/earnings/service";
import { getEstimatorContext } from "@/features/calculator/service";
import { CargarVentaButton } from "@/features/orders/components/cargar-venta-button";
import type { OrderStatus } from "@/features/orders/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v !== "" ? v : undefined;
}

export default async function PedidosAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermissionPage("pedidos", "ver");
  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status = STATUSES.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;
  const pageParam = Number(first(sp.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [result, counts, manualSales, shares, estimator] = await Promise.all([
    listOrdersAdmin({ status, page, pageSize: 20 }),
    getOrderStatusCounts(),
    listManualSales(),
    listProfitShares(),
    getEstimatorContext(),
  ]);

  // Socios actuales: precargan el reparto del formulario de venta manual.
  const partners = shares.map((s) => ({ name: s.name, pct: Number(s.pct) }));

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const baseParams: Record<string, string> = {};
  if (status) baseParams.status = status;

  const chip = (
    key: OrderStatus | "all",
    label: string,
    count: number,
    active: boolean,
  ) => (
    <Link
      key={key}
      href={key === "all" ? "/admin/pedidos" : `/admin/pedidos?status=${key}`}
      className={cn("chip", active && "active")}
    >
      {label} <b className="opacity-60">{count}</b>
    </Link>
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Operación</div>
          <h1 className="page-title">Pedidos</h1>
          <div className="page-sub">{totalAll} pedidos en total</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/pedidos/importar" className="btn btn-secondary">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Importar Excel/CSV
          </Link>
          <CargarVentaButton partners={partners} estimator={estimator} />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {chip("all", "Todos", totalAll, !status)}
        {STATUSES.map((s) =>
          chip(s, ORDER_STATUS_LABEL[s], counts[s] ?? 0, status === s),
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="ui-card text-dim p-10 text-center text-sm">
          No hay pedidos con este filtro.
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b className="font-display text-fg tracking-wide">
                        {o.orderNumber}
                      </b>
                      <div className="text-faint text-[11.5px]">
                        {dateFmt.format(o.createdAt)}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className="avatar"
                          style={{ width: 30, height: 30, fontSize: 11 }}
                        >
                          {(o.customerName?.[0] ?? "?").toUpperCase()}
                        </span>
                        <span className="text-dim">
                          {o.customerName ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="text-dim">
                      {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                    </td>
                    <td>
                      <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </td>
                    <td className="text-fg text-right">
                      {formatPrice(o.total)}
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        className="text-primary hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        params={baseParams}
        basePath="/admin/pedidos"
      />

      {manualSales.length > 0 ? (
        <div className="mt-8">
          <div className="eyebrow mb-3">
            Ventas manuales · {manualSales.length}
          </div>
          <div className="ui-card overflow-hidden">
            <div className="table-wrap" style={{ border: "none" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Detalle</th>
                    <th>Pago</th>
                    <th>Estado</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {manualSales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-dim whitespace-nowrap">
                        {dateFmt.format(s.saleDate)}
                      </td>
                      <td className="text-fg">{s.customerName}</td>
                      <td className="text-dim">{s.detail ?? "—"}</td>
                      <td className="text-dim">
                        {PAYMENT_METHOD_LABEL[s.paymentMethod]}
                      </td>
                      <td>
                        <Badge variant={ORDER_STATUS_VARIANT[s.status]}>
                          {ORDER_STATUS_LABEL[s.status]}
                        </Badge>
                      </td>
                      <td className="text-fg text-right">
                        {formatPrice(Number(s.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
