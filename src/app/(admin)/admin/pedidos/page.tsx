import Link from "next/link";
import { can, isAdmin, requirePermissionPage } from "@/core/auth/permissions";
import { getCurrentUser } from "@/core/auth/session";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { listOrdersAdmin } from "@/features/orders/services/orderAdminService";
import { listManualSales } from "@/features/orders/services/manualSaleService";
import { listProfitShares } from "@/features/earnings/service";
import {
  getEstimatorContext,
  type EstimatorContext,
} from "@/features/calculator/service";
import { CargarVentaButton } from "@/features/orders/components/cargar-venta-button";
import {
  OrdersBoard,
  type UnifiedSale,
} from "@/features/orders/components/orders-board";
import { listColorCatalog, listSaleColors } from "@/features/inventory/queries";
import { listProductsForSale } from "@/features/products/services/catalogService";
import { safeLoad } from "@/lib/safe-load";
import { getQuoteDefaults } from "@/features/quotes/service";
import { SALES_TIME_ZONE, monthKeyOf } from "@/features/orders/sale-month";
import {
  PendientesCard,
  type TaskRow,
} from "@/features/pendientes/components/pendientes-card";
import { listTeamTasks } from "@/features/pendientes/queries";
import type { TeamTaskLists, TeamTaskView } from "@/features/pendientes/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

// Fechas de los pendientes ya formateadas en el servidor, en hora de Argentina
// (así servidor y navegador muestran exactamente lo mismo).
const taskDateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SALES_TIME_ZONE,
});

function toTaskRow(t: TeamTaskView): TaskRow {
  return {
    id: t.id,
    body: t.body,
    author: t.author,
    mine: t.mine,
    createdAt: taskDateFmt.format(new Date(t.createdAt)),
    doneBy: t.doneBy,
    doneAt: t.doneAt ? taskDateFmt.format(new Date(t.doneAt)) : null,
  };
}

export default async function PedidosAdminPage() {
  await requirePermissionPage("pedidos", "ver");
  const [admin, canEdit, quoteDefaults, user] = await Promise.all([
    isAdmin(),
    can("pedidos", "editar"),
    getQuoteDefaults(),
    getCurrentUser(),
  ]);

  // Se cargan todas las ventas (online + manuales) para una tabla unificada con
  // filtros del lado del cliente. safeLoad: si la base se traba, renderiza con
  // datos parciales + aviso en vez de colgarse.
  const [
    ordersR,
    manualR,
    sharesR,
    estimatorR,
    colorsR,
    productsR,
    catalogR,
    tasksR,
  ] = await Promise.all([
    safeLoad("pedidos", listOrdersAdmin({ page: 1, pageSize: 500 }), {
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
    }),
    safeLoad("ventas manuales", listManualSales(), []),
    safeLoad("socios", listProfitShares(), []),
    safeLoad(
      "calculadora",
      getEstimatorContext(),
      null as EstimatorContext | null,
    ),
    safeLoad(
      "colores de ventas",
      listSaleColors(),
      {} as Record<string, string[]>,
    ),
    safeLoad("productos", listProductsForSale(), []),
    // Catálogo de colores (Filamentos): da el hex REAL de cada color para el
    // muestrario de la venta manual. Nunca un hex hardcodeado.
    safeLoad("colores", listColorCatalog(), []),
    // Pendientes del equipo (pedido de Agustín, 2026-11-17). Con safeLoad: si
    // fallan, Pedidos se sigue viendo y solo falta esa tarjeta.
    safeLoad("pendientes", listTeamTasks(user?.id ?? null), {
      open: [],
      done: [],
    } as TeamTaskLists),
  ]);
  const online = ordersR.value.items;
  const manual = manualR.value;
  const shares = sharesR.value;
  const estimator = estimatorR.value;
  const saleColors = colorsR.value;
  const products = productsR.value;
  const colorHex: Record<string, string> = {};
  for (const c of catalogR.value) colorHex[c.name] = c.hex ?? "#888";
  // Categorías para la venta manual (las presentes en el catálogo de productos).
  const saleCategories = [
    ...new Set(
      products.map((p) => p.categoryName).filter((c): c is string => !!c),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const degraded: string[] = [];
  if (!ordersR.ok) degraded.push("los pedidos online");
  if (!manualR.ok) degraded.push("las ventas manuales");
  if (!sharesR.ok) degraded.push("los socios");
  if (!estimatorR.ok) degraded.push("la calculadora de ventas");
  if (!tasksR.ok) degraded.push("los pendientes del equipo");

  const partners = shares.map((s) => ({ name: s.name, pct: Number(s.pct) }));

  const items: UnifiedSale[] = [
    ...online.map(
      (o): UnifiedSale => ({
        id: o.id,
        source: "online",
        date: o.createdAt,
        customerName: o.customerName,
        // Se muestra QUÉ se pidió (productos); el número queda como referencia.
        label: o.itemsSummary || o.orderNumber,
        ref: o.orderNumber,
        paymentMethod: o.paymentMethod,
        status: o.status,
        total: o.total,
        colors: saleColors[o.id] ?? [],
      }),
    ),
    ...manual.map(
      (s): UnifiedSale => ({
        id: s.id,
        source: "manual",
        date: s.saleDate,
        customerName: s.customerName,
        label: s.detail ?? "",
        paymentMethod: s.paymentMethod,
        status: s.status,
        total: Number(s.total),
        colors: saleColors[s.id] ?? [],
        // Para el editor de venta manual (números): detalle, categoría y costo.
        detail: s.detail,
        category: s.category,
        amortization: s.amortization != null ? Number(s.amortization) : null,
        // Desglose por combinación (venta con varias combinaciones de colores).
        items: s.items.map((it) => ({
          productName: it.productName,
          variantLabel: it.variantLabel,
          color: it.color,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
        })),
      }),
    ),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      <DegradedNotice sources={degraded} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Operación</div>
          <h1 className="page-title">Pedidos</h1>
          <div className="page-sub">{items.length} ventas en total</div>
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
          {estimator ? (
            <CargarVentaButton
              categories={saleCategories}
              partners={partners}
              estimator={estimator}
              products={products}
              colorHex={colorHex}
            />
          ) : null}
        </div>
      </div>

      {/* Si no se pudieron cargar no se muestra la tarjeta vacía: parecería que
          no hay nada pendiente (el aviso de arriba ya dice que faltan). */}
      {tasksR.ok ? (
        <PendientesCard
          open={tasksR.value.open.map(toTaskRow)}
          done={tasksR.value.done.map(toTaskRow)}
        />
      ) : null}

      <OrdersBoard
        items={items}
        // Mes de hoy en hora de Argentina: el tablero arranca filtrado ahí.
        currentMonth={monthKeyOf(new Date()) ?? ""}
        isAdmin={admin}
        canEdit={canEdit}
        quoteDefaults={quoteDefaults}
      />
    </div>
  );
}
