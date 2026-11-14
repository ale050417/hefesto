import { z } from "zod";
import {
  apiError,
  apiOk,
  requireApiPerm,
  requireApiStaff,
  withApi,
} from "@/core/api/respond";
import { canForUser, isAdminForUser } from "@/core/auth/permissions";
import {
  businessErrorResponse,
  validationResponse,
} from "@/features/orders/api-errors";
import {
  editManualSale,
  removeManualSale,
} from "@/features/orders/manual-sale-flow";
import { manualSaleEditSchema } from "@/features/orders/schemas";
import { getManualSale } from "@/features/orders/services/manualSaleService";

/**
 * Venta manual (mostrador) para la app (2026-10-31).
 *  - GET    → detalle. Permiso pedidos/ver. Es el espejo del detalle de un
 *             pedido online (`/admin/orders/:id`) para que la pantalla de la
 *             app sea una sola: mismas claves donde el dato existe en ambos
 *             mundos. Costo y ganancia (`amortization`, `profit`) solo para
 *             quien puede editar la venta, como el editor de la web.
 *  - PATCH  → edita números y metadatos (cliente, detalle, categoría, fecha,
 *             medio de pago, total y costo). Permiso pedidos/editar, igual que
 *             `updateManualSaleAction`. No toca stock ni estado.
 *  - DELETE → elimina la venta y repone el filamento. SOLO admin, igual que
 *             `deleteManualSaleAction`.
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();

export const GET = withApi(
  "admin/manual-sales/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "pedidos", "ver");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Venta inválida.");

    const s = await getManualSale(id.data);
    if (!s) return apiError("not_found", "No encontramos la venta.");
    const canEdit = await canForUser(auth.user, "pedidos", "editar");

    return apiOk({
      id: s.id,
      saleDate: s.saleDate,
      customerName: s.customerName,
      detail: s.detail,
      category: s.category,
      status: s.status,
      paymentMethod: s.paymentMethod,
      quantity: s.quantity,
      total: Number(s.total),
      amortization:
        canEdit && s.amortization != null ? Number(s.amortization) : null,
      profit: canEdit && s.profit != null ? Number(s.profit) : null,
      cancelReason: s.cancelReason,
      // Si la venta trae desglose, se muestra por línea; si no, es una venta
      // simple y la app arma una sola línea con `detail` + `quantity`.
      items: s.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        variantLabel: i.variantLabel,
        color: i.color,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
    });
  },
);

export const PATCH = withApi(
  "admin/manual-sales/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "pedidos", "editar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Venta inválida.");

    // `detail` y `category` vacíos pueden llegar como null: el schema de la web
    // los espera "" u omitidos.
    const raw: unknown = await request.json().catch(() => null);
    const payload =
      raw && typeof raw === "object"
        ? Object.fromEntries(
            Object.entries(raw).map(([k, v]) => [
              k,
              v === null && (k === "detail" || k === "category") ? "" : v,
            ]),
          )
        : raw;
    const body = manualSaleEditSchema.safeParse(payload);
    if (!body.success) {
      return validationResponse(body.error, "Revisá los datos de la venta.");
    }

    if (!(await getManualSale(id.data))) {
      return apiError("not_found", "No encontramos la venta.");
    }
    try {
      await editManualSale({
        saleId: id.data,
        input: body.data,
        actorId: auth.user.id,
      });
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);

export const DELETE = withApi(
  "admin/manual-sales/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    // Borrar una venta toca facturación, ganancias y reportes: SOLO admin.
    if (!(await isAdminForUser(auth.user))) {
      return apiError(
        "forbidden",
        "Eliminar ventas es solo para administradores.",
      );
    }

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Venta inválida.");
    if (!(await getManualSale(id.data))) {
      return apiError("not_found", "No encontramos la venta.");
    }

    try {
      await removeManualSale({ saleId: id.data, actorId: auth.user.id });
      return apiOk({ ok: true });
    } catch (error) {
      return businessErrorResponse(error);
    }
  },
);
