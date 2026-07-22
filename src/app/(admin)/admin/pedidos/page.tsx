import Link from "next/link";
import { can, isAdmin, requirePermissionPage } from "@/core/auth/permissions";
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
import { listSaleColors } from "@/features/inventory/queries";
import { listProductsForSale } from "@/features/products/services/catalogService";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

export default async function PedidosAdminPage() {
  await requirePermissionPage("pedidos", "ver");
  const [admin, canEdit] = await Promise.all([
    isAdmin(),
    can("pedidos", "editar"),
  ]);

  // Se cargan todas las ventas (online + manuales) para una tabla unificada con
  // filtros del lado del cliente. safeLoad: si la base se traba, renderiza con
  // datos parciales + aviso en vez de colgarse.
  const [ordersR, manualR, sharesR, estimatorR, colorsR, productsR] =
    await Promise.all([
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
    ]);
  const online = ordersR.value.items;
  const manual = manualR.value;
  const shares = sharesR.value;
  const estimator = estimatorR.value;
  const saleColors = colorsR.value;
  const products = productsR.value;
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
            />
          ) : null}
        </div>
      </div>

      <OrdersBoard items={items} isAdmin={admin} canEdit={canEdit} />
    </div>
  );
}
