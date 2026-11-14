import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { ORDER_STATUS_LABEL } from "@/features/orders/constants";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import {
  BOARD_STATES,
  buildBoardOrders,
  hoursSince,
  isLate,
} from "@/features/production/board";
import { safeLoad } from "@/lib/safe-load";

/**
 * GET /api/v1/admin/produccion — la cola de producción para la app (2026-10-31).
 * Permiso produccion/ver. Es el MISMO tablero que `/admin/produccion`: pedidos
 * online + ventas manuales por etapa (pendiente de pago → entregado), sin
 * cancelados y con los entregados ocultos un día después. Cada tarjeta trae su
 * antigüedad en horas y si está demorada (48 h o más en taller).
 *
 * Como la página web, tolera que falle una de las dos fuentes: devuelve lo que
 * pudo cargar y avisa en `degraded` (nada de ceros silenciosos).
 */
export const dynamic = "force-dynamic";

export const GET = withApi("admin/produccion", async (request: Request) => {
  const auth = await requireApiPerm(request, "produccion", "ver");
  if ("response" in auth) return auth.response;

  const [ordersR, manualR] = await Promise.all([
    safeLoad(
      "cola de producción",
      listOrdersAdmin({ page: 1, pageSize: 500 }),
      { items: [], page: 1, total: 0, totalPages: 1 },
    ),
    safeLoad("ventas manuales", listManualSales(), []),
  ]);

  const now = Date.now();
  const cards = buildBoardOrders(ordersR.value.items, manualR.value, now);

  const items = cards.map((c) => {
    const hours = hoursSince(c.createdAt, now);
    return {
      id: c.id,
      source: c.source,
      label: c.label,
      customerName: c.customerName,
      total: c.total,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      ageHours: hours,
      late: isLate(c.status, hours),
    };
  });

  return apiOk({
    columns: BOARD_STATES.map((status) => ({
      status,
      label: ORDER_STATUS_LABEL[status],
      count: items.filter((i) => i.status === status).length,
    })),
    items,
    counts: {
      total: items.length,
      online: items.filter((i) => i.source === "online").length,
      manual: items.filter((i) => i.source === "manual").length,
      late: items.filter((i) => i.late).length,
    },
    degraded: [
      ...(ordersR.ok ? [] : ["pedidos online"]),
      ...(manualR.ok ? [] : ["ventas manuales"]),
    ],
  });
});
