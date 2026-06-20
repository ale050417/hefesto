import Link from "next/link";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import type { OrderStatus } from "@/features/orders/types";
import { formatPrice } from "@/lib/format";

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

  const result = await listOrdersAdmin({ status, page, pageSize: 20 });

  const baseParams: Record<string, string> = {};
  if (status) baseParams.status = status;

  const field =
    "rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";

  return (
    <div>
      <div>
        <p className="eyebrow">Gestión</p>
        <h1 className="font-display text-fg mt-1 text-2xl">Pedidos</h1>
      </div>

      <form method="get" className="mt-6 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className={field}>
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ size: "sm" })}>
          Filtrar
        </button>
      </form>

      <p className="text-dim mt-4 text-sm">
        {result.total} {result.total === 1 ? "pedido" : "pedidos"}
      </p>

      <div className="border-surface-2 mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-dim text-left text-xs">
            <tr>
              <th className="p-3 font-medium">Pedido</th>
              <th className="p-3 font-medium">Cliente</th>
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Total</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-dim p-6 text-center">
                  No hay pedidos.
                </td>
              </tr>
            ) : (
              result.items.map((o) => (
                <tr key={o.id} className="border-surface-2 border-t">
                  <td className="text-fg font-display p-3 tracking-wide">
                    {o.orderNumber}
                  </td>
                  <td className="text-dim p-3">{o.customerName ?? "—"}</td>
                  <td className="text-dim p-3">
                    {dateFmt.format(o.createdAt)}
                  </td>
                  <td className="text-fg p-3">{formatPrice(o.total)}</td>
                  <td className="p-3">
                    <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="text-primary text-sm hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        params={baseParams}
        basePath="/admin/pedidos"
      />
    </div>
  );
}
