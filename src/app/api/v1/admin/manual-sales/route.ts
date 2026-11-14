import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { listFilamentsView } from "@/features/inventory/queries";
import {
  businessErrorResponse,
  validationResponse,
} from "@/features/orders/api-errors";
import { registerManualSale } from "@/features/orders/manual-sale-flow";
import {
  buildManualSaleInput,
  manualSaleApiSchema,
} from "@/features/orders/sale-catalog";
import { manualSaleSchema } from "@/features/orders/schemas";
import { listProductsForSale } from "@/features/products/services/catalogService";

/**
 * POST /api/v1/admin/manual-sales — carga una venta manual (de mostrador) desde
 * la app (2026-10-31, pedido de Ale). Permiso pedidos/crear, igual que
 * `createManualSaleAction` de la web.
 *
 * La app manda QUÉ se vendió (producto del catálogo + tamaño + color +
 * cantidad, o una línea de texto libre con su costo); el servidor resuelve
 * precio, carretes y gramos desde el catálogo (sale-catalog.ts), revalida con
 * el mismo `manualSaleSchema` que la web y corre el mismo flujo (costos en el
 * servidor, descuento de filamento si nace cobrada, revalidación y auditoría).
 */
export const dynamic = "force-dynamic";

export const POST = withApi("admin/manual-sales", async (request: Request) => {
  const auth = await requireApiPerm(request, "pedidos", "crear");
  if ("response" in auth) return auth.response;

  const body = manualSaleApiSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!body.success) {
    return validationResponse(body.error, "Revisá los datos de la venta.");
  }

  // El catálogo y los carretes solo se leen si hay un producto de la tienda.
  const needsCatalog = body.data.items.some((i) => i.productId);
  const [products, filaments] = needsCatalog
    ? await Promise.all([listProductsForSale(), listFilamentsView()])
    : [[], []];

  const built = buildManualSaleInput(body.data, {
    products: new Map(products.map((p) => [p.id, p])),
    filaments,
  });
  if (!built.ok) return apiError("invalid", built.message);

  // La misma validación que la Server Action de la web.
  const parsed = manualSaleSchema.safeParse(built.candidate);
  if (!parsed.success) {
    return validationResponse(parsed.error, "Revisá los datos de la venta.");
  }

  try {
    const sale = await registerManualSale({
      input: parsed.data,
      actorId: auth.user.id,
      manualCost: built.manualCost,
    });
    return apiOk(
      { id: sale.id, total: Number(sale.total), status: sale.status },
      { status: 201 },
    );
  } catch (error) {
    return businessErrorResponse(error);
  }
});
