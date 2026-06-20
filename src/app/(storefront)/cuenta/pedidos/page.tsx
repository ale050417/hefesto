import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/features/orders/constants";
import { getMyOrders } from "@/features/orders/services/orderQueries";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pedidos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

export default async function MyOrdersPage() {
  const user = await requireUser("/cuenta/pedidos");
  const orders = await getMyOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="ui-card p-10 text-center">
        <p className="text-dim">Todavía no tenés pedidos.</p>
        <Link
          href="/catalogo"
          className={cn(buttonVariants({ variant: "primary" }), "mt-4")}
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Link
          key={o.orderNumber}
          href={`/cuenta/pedidos/${encodeURIComponent(o.orderNumber)}`}
          className="order-card flex items-center justify-between gap-4"
        >
          <div>
            <div className="text-fg font-display tracking-wide">
              {o.orderNumber}
            </div>
            <div className="text-faint text-xs">
              {dateFmt.format(o.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant={ORDER_STATUS_VARIANT[o.status]}>
              {ORDER_STATUS_LABEL[o.status]}
            </Badge>
            <span className="text-fg font-medium">{formatPrice(o.total)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
