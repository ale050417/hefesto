import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { OrdersKanban } from "@/features/production/components/production-kanban";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de producción" };

// Estados que están "en el taller" (los que se trabajan). pending_payment aún no
// está pago; cancelled/refunded quedan fuera del tablero.
const PROD_STATES = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

export default async function ProductionPage() {
  await requirePermissionPage("produccion", "ver");
  const r = await safeLoad(
    "cola de producción",
    listOrdersAdmin({ page: 1, pageSize: 500 }),
    { items: [], page: 1, total: 0, totalPages: 1 },
  );
  const orders = r.value.items.filter((o) => PROD_STATES.includes(o.status));

  return (
    <div className="view grid gap-4">
      <DegradedNotice sources={r.ok ? [] : ["la cola de producción"]} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Producción</div>
          <h1 className="page-title">Cola de producción</h1>
          <div className="page-sub">
            Los pedidos reales, por etapa. Arrastrá cada uno según avanza el
            trabajo.
          </div>
        </div>
      </div>
      <OrdersKanban orders={orders} />
    </div>
  );
}
