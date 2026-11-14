import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { ValidationError } from "@/core/errors";
import { getAmortization } from "@/features/calculator/service";
import type { ManualSaleEditInput, ManualSaleInput } from "./schemas";
import {
  applyManualSaleLines,
  computeManualSaleCosts,
  createManualSale,
  deductQuantityFor,
  deleteManualSale,
  updateManualSale,
  type ManualSale,
} from "./services/manualSaleService";
import { deleteOrderAdmin } from "./services/orderAdminService";

/**
 * Alta / edición / baja de ventas con TODOS sus efectos (2026-10-31, pedido de
 * Ale: app móvil). Antes vivían inline en `createManualSaleAction`,
 * `updateManualSaleAction`, `deleteManualSaleAction` y `deleteOrderAction`; se
 * extrajeron para que la web (Server Action) y la API de la app
 * (`/api/v1/admin/...`) hagan EXACTAMENTE lo mismo: costos en el servidor,
 * descuento/reposición de filamento, revalidación del panel y auditoría.
 *
 * La AUTORIZACIÓN (pedidos/crear, pedidos/editar, "borrar es solo admin") la
 * valida cada caller antes de llamar acá; estas funciones asumen que ya pasó.
 * Los errores de negocio salen como `AppError` (el caller los traduce).
 */

const MSG_SIN_AMORTIZACION =
  "Cargá la amortización con la calculadora (gramos/horas y filamento).";

/** Las pantallas que muestran ventas / ganancias / reportes quedan viejas. */
function revalidateSales() {
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/ganancias");
  revalidatePath("/admin/reportes");
}

/**
 * Registra una venta manual ya VALIDADA con `manualSaleSchema`. Calcula el
 * costo en el servidor (gramos/horas + filamento), guarda la venta, descuenta
 * el stock si nace cobrada y deja auditoría.
 *
 * `manualCost`: costo TOTAL explícito de las líneas que no tienen carrete ni
 * gramos (texto libre en la app). Solo la API de la app lo manda; con
 * `undefined` el comportamiento es el de siempre de la web: si el filamento no
 * da un costo > 0, se rechaza ("nunca 0 silencioso").
 */
export async function registerManualSale(params: {
  input: ManualSaleInput;
  actorId: string | null;
  manualCost?: number;
}): Promise<ManualSale> {
  const { input, actorId, manualCost } = params;
  // Venta con VARIAS combinaciones de colores (2026-08-09): el total, la
  // cantidad y los gramos se recalculan acá desde las líneas ANTES de costear.
  // Sin líneas, `data` es la entrada tal cual (venta simple de siempre).
  const data = applyManualSaleLines(input);
  const hasItems = (input.items?.length ?? 0) > 0;
  // Amortización (costo) obligatoria: se calcula en el servidor desde
  // gramos/horas y el FILAMENTO elegido (por id; `material` queda de fallback
  // para cargas viejas). La calculadora cotiza UNA pieza: acá se escala por la
  // cantidad. La ganancia (total − amort total) es lo que se reparte.
  const unitAmort = await getAmortization({
    filamentId: data.filamentId ?? null,
    material: data.material ?? null,
    grams: data.grams ?? 0,
    hours: (data.printMinutes ?? 0) / 60,
  });
  if (!(unitAmort > 0) && manualCost == null) {
    throw new ValidationError(MSG_SIN_AMORTIZACION);
  }
  const costs = computeManualSaleCosts({
    unitAmortization: unitAmort > 0 ? unitAmort : 0,
    total: data.total,
    // Con líneas, los gramos YA son los de toda la venta (se sumaron las
    // combinaciones): volver a multiplicar por la cantidad costearía de más.
    quantity: deductQuantityFor({ hasItems, quantity: data.quantity }),
  });
  // Insumos: son un COSTO real (vaso, argollas, etc.), NO se cobran aparte. Van a
  // la amortización y BAJAN la ganancia; el total no los incluye (fix 2026-07).
  const extrasCost = data.extrasCost ?? 0;
  const amortization = costs.amortization + extrasCost + (manualCost ?? 0);
  const withCosts = {
    ...data,
    amortization,
    profit: data.total - amortization,
  };
  const sale = await createManualSale(withCosts, actorId);
  revalidateSales();
  await recordAudit({
    actorId,
    action: "manual_sale.created",
    entityType: "manual_sale",
    entityId: sale.id,
    metadata: { total: sale.total, customer: sale.customerName },
  });
  return sale;
}

/**
 * Edita los números + metadatos de una venta manual ya cargada (ver
 * `updateManualSale`): recalcula la ganancia en el servidor y NO toca stock
 * ni estado.
 */
export async function editManualSale(params: {
  saleId: string;
  input: ManualSaleEditInput;
  actorId: string | null;
}): Promise<void> {
  const { saleId, input, actorId } = params;
  await updateManualSale(saleId, input);
  revalidateSales();
  await recordAudit({
    actorId,
    action: "manual_sale.updated",
    entityType: "manual_sale",
    entityId: saleId,
    metadata: { total: input.total },
  });
}

/**
 * Elimina una venta manual. `deleteManualSale` repone antes el filamento que
 * había descontado. SOLO admin: lo valida el caller.
 */
export async function removeManualSale(params: {
  saleId: string;
  actorId: string | null;
}): Promise<void> {
  const { saleId, actorId } = params;
  await deleteManualSale(saleId);
  await recordAudit({
    actorId,
    action: "manual_sale.deleted",
    entityType: "manual_sale",
    entityId: saleId,
  });
  revalidateSales();
}

/**
 * Elimina un pedido online de forma permanente. `deleteOrderAdmin` repone el
 * filamento y el repository revierte puntos/cupón en una transacción. SOLO
 * admin: lo valida el caller.
 */
export async function removeOnlineOrder(params: {
  orderId: string;
  actorId: string | null;
}): Promise<void> {
  const { orderId, actorId } = params;
  await deleteOrderAdmin(orderId);
  await recordAudit({
    actorId,
    action: "order.deleted",
    entityType: "order",
    entityId: orderId,
  });
  revalidateSales();
}
