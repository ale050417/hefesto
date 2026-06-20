import Link from "next/link";
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
  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status = STATUSES.includes(statusParam as OrderStatus)
    ? (statusParam as OrderStatus)
    : undefined;
  const pageParam = Number(first(sp.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [result, counts] = await Promise.all([
    listOrdersAdmin({ status, page, pageSize: 20 }),
    getOrderStatusCounts(),
  ]);

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
                  <th>Fecha</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th className="text-right">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((o) => (
                  <tr key={o.id}>
                    <td className="font-display text-fg tracking-wide">
                      {o.orderNumber}
                    </td>
                    <td className="text-dim">{o.customerName ?? "—"}</td>
                    <td className="text-dim whitespace-nowrap">
                      {dateFmt.format(o.createdAt)}
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
    </div>
  );
}
