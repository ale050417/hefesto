import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import {
  OrdersKanban,
  type KanbanOrder,
} from "@/features/production/components/production-kanban";
import type { OrderListItem, OrderStatus } from "@/features/orders/types";
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

const DELIVERED_HIDE_MS = 24 * 60 * 60 * 1000;

type BoardManualSale = {
  id: string;
  status: OrderStatus;
  detail: string | null;
  customerName: string;
  total: string;
  saleDate: Date;
};

// Arma las cards del tablero (online + manual) y oculta las entregadas hace más
// de un día. Va en un helper y no en el cuerpo del componente porque usa
// Date.now(): la regla de pureza de React no permite llamar funciones impuras
// durante el render de un Server Component.
function buildBoardOrders(
  items: OrderListItem[],
  sales: BoardManualSale[],
): KanbanOrder[] {
  const now = Date.now();
  const stillOnBoard = (status: string, deliveredSince: Date) =>
    BOARD_STATES.includes(status) &&
    (status !== "delivered" ||
      now - deliveredSince.getTime() < DELIVERED_HIDE_MS);

  const online: KanbanOrder[] = items
    .filter((o) => stillOnBoard(o.status, o.updatedAt))
    .map((o) => ({
      id: o.id,
      source: "online",
      label: o.itemsSummary || o.orderNumber,
      customerName: o.customerName,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }));
  const manual: KanbanOrder[] = sales
    .filter((s) => stillOnBoard(s.status, s.saleDate))
    .map((s) => ({
      id: s.id,
      source: "manual",
      label: s.detail ?? "Venta manual",
      customerName: s.customerName,
      total: Number(s.total),
      status: s.status,
      createdAt: s.saleDate,
    }));
  return [...online, ...manual];
}

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
