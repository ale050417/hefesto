import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listRecentManualCustomers } from "@/features/orders/services/manualSaleService";
import { listProductsForSale } from "@/features/products/services/catalogService";

/**
 * GET /api/v1/admin/manual-sales/form-data — datos de apoyo del formulario de
 * venta manual de la app (2026-10-31). Permiso pedidos/ver.
 *  - `categories`: las categorías presentes en el catálogo de productos (misma
 *    lista que ofrece el formulario web).
 *  - `recentCustomers`: clientes de ventas manuales anteriores, para
 *    autocompletar (la web los guarda como texto libre).
 * Si una de las dos fuentes falla, esa lista vuelve vacía: el formulario sigue
 * andando (son ayudas, no datos de la venta).
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/manual-sales/form-data",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "pedidos", "ver");
    if ("response" in auth) return auth.response;

    const [products, recentCustomers] = await Promise.all([
      listProductsForSale().catch(() => []),
      listRecentManualCustomers().catch(() => [] as string[]),
    ]);
    const categories = [
      ...new Set(
        products.map((p) => p.categoryName).filter((c): c is string => !!c),
      ),
    ].sort((a, b) => a.localeCompare(b, "es"));

    return apiOk({ categories, recentCustomers });
  },
);
