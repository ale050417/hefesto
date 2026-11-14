import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import {
  listColorCatalog,
  listFilamentsView,
} from "@/features/inventory/queries";
import {
  normalizeSearch,
  saleCatalogItem,
} from "@/features/orders/sale-catalog";
import { listProductsForSale } from "@/features/products/services/catalogService";

/**
 * GET /api/v1/admin/manual-sales/catalog — productos del catálogo para elegir
 * qué se vendió al cargar una venta manual desde la app (2026-10-31). Permiso
 * pedidos/crear. Es el "Cargar desde un producto de la tienda" del formulario
 * web: cada producto trae sus tamaños, colores y TODAS las combinaciones con el
 * precio que cobra la tienda (`saleUnitPrice`), más si tiene carrete/gramos
 * para descontar stock.
 * Query: q (nombre o categoría), limit (máx 60).
 */
export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().positive().max(60).default(30),
});

export const GET = withApi(
  "admin/manual-sales/catalog",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "pedidos", "crear");
    if ("response" in auth) return auth.response;

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) return apiError("invalid", "Búsqueda inválida.");
    const { q, limit } = parsed.data;

    const [products, filaments, colors] = await Promise.all([
      listProductsForSale(),
      listFilamentsView(),
      // El catálogo de colores solo da el hex del círculo: si falla, se ve gris.
      listColorCatalog().catch(() => []),
    ]);
    const hexByColor = new Map(
      colors
        .filter((c) => c.hex)
        .map((c) => [c.name.trim().toLowerCase(), c.hex as string]),
    );

    const needle = q ? normalizeSearch(q) : "";
    const matches = needle
      ? products.filter((p) =>
          normalizeSearch(`${p.name} ${p.categoryName ?? ""}`).includes(needle),
        )
      : products;

    return apiOk({
      total: matches.length,
      items: matches
        .slice(0, limit)
        .map((p) => saleCatalogItem(p, filaments, hexByColor)),
    });
  },
);
