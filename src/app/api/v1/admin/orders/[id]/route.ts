import { z } from "zod";
import {
  apiError,
  apiOk,
  requireApiPerm,
  requireApiStaff,
  withApi,
} from "@/core/api/respond";
import { isAdminForUser } from "@/core/auth/permissions";
import { toActionError } from "@/core/errors";
import { businessErrorResponse } from "@/features/orders/api-errors";
import { removeOnlineOrder } from "@/features/orders/manual-sale-flow";
import {
  getOrderAdmin,
  setOrderMeta,
} from "@/features/orders/services/orderAdminService";

/**
 * Detalle de un pedido online para el admin de la app (2026-10-31).
 *  - GET    → pedido completo (items, historial, cliente). Permiso pedidos/ver.
 *  - PATCH  → código de seguimiento / nota interna. Permiso pedidos/editar
 *             (igual que `updateOrderMetaAction` del panel web).
 *  - DELETE → elimina el pedido de forma permanente (cualquier estado), repone
 *             el filamento y revierte puntos y cupón. SOLO admin, igual que
 *             `deleteOrderAction` del panel web.
 */
export const dynamic = "force-dynamic";

const idSchema = z.uuid();

export const GET = withApi(
  "admin/orders/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "pedidos", "ver");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Pedido inválido.");

    const o = await getOrderAdmin(id.data);
    if (!o) return apiError("not_found", "No encontramos el pedido.");

    return apiOk({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentMethod: o.paymentMethod,
      subtotal: Number(o.subtotal),
      discountAmount: Number(o.discountAmount),
      shippingCost: Number(o.shippingCost),
      total: Number(o.total),
      shippingAddress: o.shippingAddress,
      trackingCode: o.trackingCode,
      internalNote: o.internalNote,
      cancelReason: o.cancelReason,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      customer: o.customer,
      items: o.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        variantLabel: i.variantLabel,
        unitPrice: Number(i.unitPrice),
        quantity: i.quantity,
        lineTotal: Number(i.lineTotal),
      })),
      history: o.history.map((h) => ({
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        note: h.note,
        createdAt: h.createdAt,
      })),
    });
  },
);

const metaSchema = z
  .object({
    trackingCode: z.string().trim().max(120).nullable().optional(),
    internalNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.trackingCode !== undefined || v.internalNote !== undefined, {
    message: "Nada para actualizar.",
  });

export const PATCH = withApi(
  "admin/orders/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiPerm(request, "pedidos", "editar");
    if ("response" in auth) return auth.response;

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Pedido inválido.");

    const body = metaSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("invalid", "Datos inválidos.");

    try {
      // Cada campo se toca SOLO si vino en el body (undefined = no tocar); un
      // string vacío lo limpia. Así mandar solo la nota no borra el tracking.
      await setOrderMeta(id.data, {
        ...(body.data.trackingCode !== undefined
          ? { trackingCode: body.data.trackingCode || null }
          : {}),
        ...(body.data.internalNote !== undefined
          ? { internalNote: body.data.internalNote || null }
          : {}),
      });
      return apiOk({ ok: true });
    } catch (error) {
      const e = toActionError(error);
      return apiError("invalid", e.message);
    }
  },
);

export const DELETE = withApi(
  "admin/orders/id",
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const auth = await requireApiStaff(request);
    if ("response" in auth) return auth.response;
    // Destructivo y toca plata/puntos: SOLO admin (igual que cancelar/reembolsar).
    if (!(await isAdminForUser(auth.user))) {
      return apiError(
        "forbidden",
        "Eliminar pedidos es solo para administradores.",
      );
    }

    const id = idSchema.safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Pedido inválido.");

    try {
      await removeOnlineOrder({ orderId: id.data, actorId: auth.user.id });
      return apiOk({ ok: true });
    } catch (error) {
      // Pedido inexistente → 404 con su mensaje (NotFoundError del service).
      return businessErrorResponse(error);
    }
  },
);
