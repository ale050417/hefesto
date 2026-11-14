import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import { OrdersKanban } from "@/features/production/components/production-kanban";
import { buildBoardOrders } from "@/features/production/board";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de producción" };

// Las tarjetas se arman en features/production/board.ts (la comparte la API de
// la app móvil): online + manual, sin cancelados y con las entregadas ocultas
// un día después.

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

  // El tablero es de trabajo EN CURSO: una vez entregado, la tarjeta se queda
  // 1 día (para verla al cierre del día) y después desaparece sola.
  const orders = buildBoardOrders(ordersR.value.items, manualR.value);

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
            descuenta el stock. Las entregadas se ocultan solas un día después.
          </div>
        </div>
      </div>
      <OrdersKanban orders={orders} />
    </div>
  );
}
