import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import {
  OrdersKanban,
  type KanbanOrder,
} from "@/features/production/components/production-kanban";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de producción" };

// Estados del tablero (flujo de trabajo). Se excluyen cancelado/reembolsado:
// son salidas terminales, no etapas del taller.
const BOARD_STATES = [
  "pending_payment",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

export default async function ProductionPage() {
  await requirePermissionPage("produccion", "ver");
  const [ordersR, manualR] = await Promise.all([
    safeLoad(
      "cola de producción",
      listOrdersAdmin({ page: 1, pageSize: 500 }),
      {
        items: [],
        page: 1,
        total: 0,
        totalPages: 1,
      },
    ),
    safeLoad("ventas manuales", listManualSales(), []),
  ]);

  const online: KanbanOrder[] = ordersR.value.items.map((o) => ({
    id: o.id,
    source: "online",
    label: o.itemsSummary || o.orderNumber,
    customerName: o.customerName,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
  }));
  const manual: KanbanOrder[] = manualR.value.map((s) => ({
    id: s.id,
    source: "manual",
    label: s.detail ?? "Venta manual",
    customerName: s.customerName,
    total: Number(s.total),
    status: s.status,
    createdAt: s.saleDate,
  }));
  const orders = [...online, ...manual].filter((o) =>
    BOARD_STATES.includes(o.status),
  );

  return (
    <div className="view grid gap-4">
      <DegradedNotice
        sources={!ordersR.ok || !manualR.ok ? ["la cola de producción"] : []}
      />
      <div className="page-head">
        <div>
          <div className="eyebrow">Producción</div>
          <h1 className="page-title">Cola de producción</h1>
          <div className="page-sub">
            Tus ventas (online y manuales) por etapa. Arrastrá cada una según
            avanza el trabajo; al pasar a &ldquo;Pago confirmado&rdquo; se
            descuenta el stock.
          </div>
        </div>
      </div>
      <OrdersKanban orders={orders} />
    </div>
  );
}
