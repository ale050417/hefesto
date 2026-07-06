import Link from "next/link";
import { isAdmin, requirePermissionPage } from "@/core/auth/permissions";
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
import { OrdersAdminList } from "@/features/orders/components/orders-admin-list";
import { DeleteManualSaleButton } from "@/features/orders/components/delete-manual-sale-button";
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
  const admin = await isAdmin();
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
        <OrdersAdminList items={result.items} isAdmin={admin} />
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
              <table className="tbl tbl-cards">
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
                      <td
                        className="text-dim whitespace-nowrap"
                        data-label="Fecha"
                      >
                        {dateFmt.format(s.saleDate)}
                      </td>
                      <td className="text-fg" data-label="Cliente">
                        {s.customerName}
                      </td>
                      <td className="text-dim" data-label="Detalle">
                        {s.detail ?? "—"}
                      </td>
                      <td className="text-dim" data-label="Pago">
                        {PAYMENT_METHOD_LABEL[s.paymentMethod]}
                      </td>
                      <td data-label="Estado">
                        <Badge variant={ORDER_STATUS_VARIANT[s.status]}>
                          {ORDER_STATUS_LABEL[s.status]}
                        </Badge>
                      </td>
                      <td className="text-fg text-right" data-label="Total">
                        <span className="inline-flex items-center justify-end gap-1">
                          {formatPrice(Number(s.total))}
                          {admin ? (
                            <DeleteManualSaleButton
                              id={s.id}
                              label={s.customerName}
                            />
                          ) : null}
                        </span>
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
