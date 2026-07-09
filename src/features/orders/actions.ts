"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { z, type ZodError } from "zod";
import { getCurrentUser, isStaff } from "@/core/auth/session";
import { can, isAdmin } from "@/core/auth/permissions";
import { recordAudit } from "@/core/audit";
import {
  type ActionResult as CoreActionResult,
  toActionError,
} from "@/core/errors";
import { siteUrl } from "@/lib/site";
import { getAmortization } from "@/features/calculator/service";
import {
  checkoutSchema,
  manualSaleSchema,
  orderMessageSchema,
  orderStatusSchema,
  type CheckoutInput,
} from "./schemas";
import { createOrder } from "./services/orderService";
import {
  computeManualSaleCosts,
  createManualSale,
  deleteManualSale,
  updateManualSaleStatus,
} from "./services/manualSaleService";
import { getOrderCustomerId, sendOrderMessage } from "./services/orderChat";
import { notifyCustomer } from "@/features/notifications/service";
import { awardForOrder } from "@/features/rewards/service";
import { ORDER_STATUS_LABEL } from "./constants";
import {
  cancelPendingOrder,
  startMercadoPagoPayment,
} from "./services/paymentService";
import {
  deleteOrderAdmin,
  deleteOrdersAdmin,
  setOrderMeta,
  transitionOrder,
} from "./services/orderAdminService";
import { notifyOrderStatus } from "./services/orderEmails";
import type { OrderStatus } from "./types";
import {
  parseImportRow,
  IMPORT_MAX_ROWS,
  type ImportFieldKey,
} from "./import-sales";

type ActionResult =
  | { ok: true; orderNumber: string; redirectUrl?: string }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Crea el pedido desde el checkout. Autorización y validación en el servidor:
 * - exige sesión y toma el customerId de ahí (nunca del cliente);
 * - valida el payload con Zod;
 * - delega las reglas y el recálculo de precios en OrderService.
 */
export async function createOrderAction(
  input: CheckoutInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Iniciá sesión para finalizar tu compra.",
      },
    };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos del formulario.",
        fields: fieldErrors(parsed.error),
      },
    };
  }

  try {
    const order = await createOrder({ ...parsed.data, customerId: user.id });

    // Solo MercadoPago necesita redirección al checkout externo. Transferencia
    // y efectivo quedan en pending_payment y van a la pantalla de éxito.
    if (parsed.data.paymentMethod === "mercadopago") {
      try {
        const { redirectUrl } = await startMercadoPagoPayment(order.id, {
          siteUrl,
          ...(user.email ? { payerEmail: user.email } : {}),
        });
        return { ok: true, orderNumber: order.orderNumber, redirectUrl };
      } catch (paymentError) {
        // El pago no se pudo iniciar: cancelamos el pedido para no dejarlo
        // huérfano en pending_payment.
        await cancelPendingOrder(order.id).catch(() => undefined);
        throw paymentError;
      }
    }

    return { ok: true, orderNumber: order.orderNumber };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

/**
 * Admin: registra una venta manual / histórica (mostrador o ventas previas).
 * NO usa el checkout: cliente por texto, total cargado a mano, estado a
 * elección. Se guarda en `manual_sales` (no en `orders`). Requiere staff.
 */
export async function createManualSaleAction(
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("pedidos", "crear"))) return NOT_STAFF;
  const user = await getCurrentUser();
  const parsed = manualSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Revisá los datos de la venta.",
        fields: fieldErrors(parsed.error),
      },
    };
  }
  // Amortización (costo) obligatoria: se calcula en el servidor desde
  // gramos/horas y el FILAMENTO elegido (por id; `material` queda de fallback
  // para cargas viejas). La calculadora cotiza UNA pieza: acá se escala por la
  // cantidad. La ganancia (total − amort total) es lo que se reparte.
  const unitAmort = await getAmortization({
    filamentId: parsed.data.filamentId ?? null,
    material: parsed.data.material ?? null,
    grams: parsed.data.grams ?? 0,
    hours: (parsed.data.printMinutes ?? 0) / 60,
  });
  if (!(unitAmort > 0)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message:
          "Cargá la amortización con la calculadora (gramos/horas y filamento).",
      },
    };
  }
  const costs = computeManualSaleCosts({
    unitAmortization: unitAmort,
    total: parsed.data.total,
    quantity: parsed.data.quantity,
  });
  const withCosts = {
    ...parsed.data,
    amortization: costs.amortization,
    profit: costs.profit,
  };
  try {
    const sale = await createManualSale(withCosts, user?.id ?? null);
    revalidatePath("/admin/pedidos");
    // La venta manual cobrada suma al reparto de ganancias y a reportes.
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    await recordAudit({
      actorId: user?.id ?? null,
      action: "manual_sale.created",
      entityType: "manual_sale",
      entityId: sale.id,
      metadata: { total: sale.total, customer: sale.customerName },
    });
    return { ok: true, orderNumber: sale.id };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin: cambia el estado de un pedido (valida máquina de estados). */
export async function transitionOrderAction(
  orderId: string,
  toStatus: OrderStatus,
  note?: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await can("pedidos", "editar"))) return NOT_STAFF;
  // Cancelar / reembolsar toca plata: SOLO admin (Cap. 8 B4, 11 y 12 del
  // Libro: "operador no cancela/reembolsa"). Guard en servidor, no en la UI.
  if (
    (toStatus === "cancelled" || toStatus === "refunded") &&
    !(await isAdmin())
  ) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Cancelar o reembolsar pedidos es solo para administradores.",
      },
    };
  }
  const user = await getCurrentUser();
  try {
    const updated = await transitionOrder(orderId, toStatus, {
      changedBy: user?.id ?? null,
      note: note ?? null,
    });
    revalidatePath(`/admin/pedidos/${orderId}`);
    revalidatePath("/admin/pedidos");
    // Efectos secundarios NO críticos (email, notificación, puntos, auditoría):
    // se corren DESPUÉS de responder (after()) para que "guardar" no espere
    // viajes de red que no cambian lo que ve el admin. Cada uno atrapa su error.
    after(async () => {
      try {
        await notifyOrderStatus(updated);
      } catch (mailError) {
        console.error("[email] no se pudo notificar el estado:", mailError);
      }
      try {
        await notifyCustomer({
          customerId: updated.customerId,
          title: `Tu pedido ${updated.orderNumber} cambió de estado`,
          body: `Ahora está: ${ORDER_STATUS_LABEL[updated.status]}.`,
          link: `/cuenta/pedidos/${updated.orderNumber}`,
        });
      } catch (notifError) {
        console.error("[notif] no se pudo crear la notificación:", notifError);
      }
      if (updated.status === "confirmed") {
        try {
          await awardForOrder({
            customerId: updated.customerId,
            orderId: updated.id,
            orderTotal: Number(updated.total),
          });
        } catch (rwErr) {
          console.error("[rewards] no se pudieron otorgar puntos:", rwErr);
        }
      }
      try {
        await recordAudit({
          actorId: user?.id ?? null,
          action: "order.status_changed",
          entityType: "order",
          entityId: orderId,
          metadata: { toStatus, ...(note ? { note } : {}) },
        });
      } catch (auditError) {
        console.error("[audit] no se pudo registrar el cambio:", auditError);
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin: guarda tracking / nota interna. */
export async function updateOrderMetaAction(
  orderId: string,
  fields: { trackingCode?: string | null; internalNote?: string | null },
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await can("pedidos", "editar"))) return NOT_STAFF;
  try {
    await setOrderMeta(orderId, fields);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Admin: elimina un pedido de forma permanente (hard delete, cualquier estado).
 * Destructivo y toca plata/puntos, así que SOLO admin (igual criterio que
 * cancelar/reembolsar, Cap. 11). El service valida que el pedido exista y el
 * repository revierte puntos/cupón de forma transaccional antes de borrar.
 */
export async function deleteOrderAction(
  orderId: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await isAdmin())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Eliminar pedidos es solo para administradores.",
      },
    };
  }
  const user = await getCurrentUser();
  try {
    await deleteOrderAdmin(orderId);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "order.deleted",
      entityType: "order",
      entityId: orderId,
    });
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const deleteOrdersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Admin: elimina VARIOS pedidos de una (limpieza de pedidos mal creados /
 * duplicados / de prueba). Mismo criterio que el borrado individual: destructivo
 * y toca plata/puntos, así que SOLO admin. Valida los ids con Zod en el servidor.
 */
export async function deleteOrdersAction(
  ids: string[],
): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: { code: string; message: string } }
> {
  if (!(await isAdmin())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Eliminar pedidos es solo para administradores.",
      },
    };
  }
  const parsed = deleteOrdersSchema.safeParse({ ids });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Selección de pedidos inválida." },
    };
  }
  const user = await getCurrentUser();
  try {
    const deleted = await deleteOrdersAdmin(parsed.data.ids);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "order.bulk_deleted",
      entityType: "order",
      metadata: { count: deleted, ids: parsed.data.ids },
    });
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    return { ok: true, deleted };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Admin: elimina una venta manual (cargada mal / duplicada / de prueba).
 * Destructivo y afecta facturación/ganancias/reportes, así que SOLO admin.
 */
export async function deleteManualSaleAction(
  saleId: string,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await isAdmin())) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Eliminar ventas es solo para administradores.",
      },
    };
  }
  const user = await getCurrentUser();
  try {
    await deleteManualSale(saleId);
    await recordAudit({
      actorId: user?.id ?? null,
      action: "manual_sale.deleted",
      entityType: "manual_sale",
      entityId: saleId,
    });
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Staff: cambia el estado de una venta manual (mismos 8 estados que un pedido).
 * Solo reetiqueta el registro; el impacto en facturación/ganancias lo resuelven
 * reportes/ganancias por estado. Valida rol + payload en el servidor.
 */
export async function updateManualSaleStatusAction(
  saleId: string,
  status: unknown,
): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  if (!(await can("pedidos", "editar"))) return NOT_STAFF;
  const idOk = z.string().uuid().safeParse(saleId);
  const statusOk = orderStatusSchema.safeParse(status);
  if (!idOk.success || !statusOk.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Venta o estado inválido." },
    };
  }
  const user = await getCurrentUser();
  try {
    await updateManualSaleStatus(idOk.data, statusOk.data);
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    await recordAudit({
      actorId: user?.id ?? null,
      action: "manual_sale.status_changed",
      entityType: "manual_sale",
      entityId: saleId,
      metadata: { status: statusOk.data },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function sendOrderMessageAction(
  orderId: string,
  input: unknown,
): Promise<CoreActionResult> {
  const user = await getCurrentUser();
  if (!user)
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Iniciá sesión." },
    };
  const parsed = orderMessageSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: "VALIDATION", message: "Escribí un mensaje." },
    };
  const staff = await isStaff();
  try {
    const ownerId = await getOrderCustomerId(orderId);
    if (!ownerId || (!staff && ownerId !== user.id)) {
      return {
        ok: false,
        error: { code: "NOT_FOUND", message: "No encontrado." },
      };
    }
    await sendOrderMessage({
      orderId,
      fromStaff: staff,
      authorId: user.id,
      body: parsed.data.body,
    });
    revalidatePath(`/cuenta/pedidos`);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

// ---------------------------------------------------------------------------
// Importación masiva de ventas manuales desde Excel/CSV (/admin/pedidos/importar)
// ---------------------------------------------------------------------------

export type ImportSalesResult = {
  imported: number;
  failed: Array<{ row: number; message: string }>;
};

/**
 * Importa ventas manuales por lote. El cliente manda las FILAS CRUDAS de la
 * planilla + el mapeo de columnas; acá se re-normaliza y re-valida TODO en el
 * servidor (no se confía en el preview del cliente, Cap. 11/14). Las filas
 * inválidas no bloquean a las válidas: se importa lo que está bien y se
 * devuelve el detalle de lo que falló, fila por fila.
 *
 * Costo (regla "nunca 0 silencioso"): por fila, si hay gramos+material se
 * calcula con la calculadora (como el form); si no, se usa el costo unitario
 * de la planilla; sin ninguno de los dos, la fila falla.
 */
export async function importManualSalesAction(input: {
  rows: unknown[][];
  mapping: Record<ImportFieldKey, number>;
  /** Número de fila de la planilla de la primera fila de datos (para mensajes). */
  firstRowNumber?: number;
}): Promise<CoreActionResult<ImportSalesResult>> {
  if (!(await can("pedidos", "crear"))) return NOT_STAFF;
  const user = await getCurrentUser();

  if (!Array.isArray(input?.rows) || input.rows.length === 0) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: "La planilla no tiene filas." },
    };
  }
  if (input.rows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: `Máximo ${IMPORT_MAX_ROWS} filas por importación (mandá la planilla en partes).`,
      },
    };
  }

  const firstRow = input.firstRowNumber ?? 2; // fila 1 = encabezados
  let imported = 0;
  const failed: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < input.rows.length; i++) {
    const rowNumber = firstRow + i;
    const parsed = parseImportRow(input.rows[i] ?? [], input.mapping);
    if (!parsed.ok) {
      failed.push({ row: rowNumber, message: parsed.errors.join(" ") });
      continue;
    }
    const row = parsed.data;
    try {
      // Costo unitario: calculado (gramos+material) o explícito de la planilla.
      let unitAmort = 0;
      if ((row.grams ?? 0) > 0 && row.material) {
        unitAmort = await getAmortization({
          filamentId: null,
          material: row.material,
          grams: row.grams ?? 0,
          hours: (row.printMinutes ?? 0) / 60,
        });
      }
      if (!(unitAmort > 0)) unitAmort = row.unitCost ?? 0;
      if (!(unitAmort > 0)) {
        failed.push({
          row: rowNumber,
          message:
            "No se pudo resolver el costo (¿el material existe en la calculadora?).",
        });
        continue;
      }
      const costs = computeManualSaleCosts({
        unitAmortization: unitAmort,
        total: row.total,
        quantity: row.quantity,
      });
      await createManualSale(
        {
          saleDate: row.saleDate,
          customerName: row.customerName,
          detail: row.detail,
          quantity: row.quantity,
          total: row.total,
          material: row.material,
          grams: row.grams,
          printMinutes: row.printMinutes,
          amortization: costs.amortization,
          profit: costs.profit,
          paymentMethod: row.paymentMethod,
          status: row.status,
        },
        user?.id ?? null,
      );
      imported++;
    } catch (error) {
      failed.push({
        row: rowNumber,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la fila.",
      });
    }
  }

  if (imported > 0) {
    revalidatePath("/admin/pedidos");
    revalidatePath("/admin/ganancias");
    revalidatePath("/admin/reportes");
    await recordAudit({
      actorId: user?.id ?? null,
      action: "manual_sale.imported",
      entityType: "manual_sale",
      entityId: null,
      metadata: { imported, failedCount: failed.length },
    });
  }

  return { ok: true, data: { imported, failed } };
}
