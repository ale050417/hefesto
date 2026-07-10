import { recordAudit } from "@/core/audit";
import type { Filament, NewFilamentMovement } from "@/features/inventory/types";
import type { OrderWithItems } from "../types";

/**
 * Descuento de filamento por pedidos ONLINE (diseño 2026-07).
 *
 * Reglas:
 *  - Al confirmarse el pago (admin o webhook MP) se descuentan
 *    peso del producto × cantidad, matcheando filamento por material del
 *    producto + color elegido (snapshot en variantLabel).
 *  - NUNCA bloquea la venta: si una línea no matchea (sin color, filamento
 *    inexistente, producto sin peso/material) queda un warning en auditoría
 *    y se sigue.
 *  - Idempotente vía ledger: si ya hay movimientos (reason 'order', ref_id =
 *    pedido), no se descuenta de nuevo (reintentos de webhook, doble hook).
 *  - cancelled/refunded/borrado → reversa con movimiento compensatorio
 *    ('restore'), también idempotente.
 *
 * Dependencias inyectables (Cap. 6/15): tests puros sin DB.
 */
export type OrderInventoryDeps = {
  getOrder: (id: string) => Promise<OrderWithItems | null>;
  getProductSpecs: (
    id: string,
  ) => Promise<{ material: string | null; weightGrams: number | null } | null>;
  listFilaments: () => Promise<Filament[]>;
  hasMovements: (reason: "order", refId: string) => Promise<boolean>;
  applyDeltas: (movements: NewFilamentMovement[]) => Promise<void>;
  restoreByRef: (reason: "order", refId: string) => Promise<number>;
  /** Matching puro (inventory). Si no se inyecta, se resuelve perezoso. */
  resolveFilament?: (
    filaments: Filament[],
    params: { material: string | null; variantLabel: string | null },
  ) => Filament | null;
  audit: typeof recordAudit;
};

const defaultDeps: OrderInventoryDeps = {
  getOrder: (id) => import("../repository").then((m) => m.findOrderById(id)),
  getProductSpecs: (id) =>
    import("@/features/products/services/catalogService").then((m) =>
      m.getProductPrintSpecs(id),
    ),
  listFilaments: () =>
    import("@/features/inventory/service").then((m) =>
      m.listFilamentsForMatching(),
    ),
  hasMovements: (reason, refId) =>
    import("@/features/inventory/service").then((m) =>
      m.hasFilamentMovements(reason, refId),
    ),
  applyDeltas: (movements) =>
    import("@/features/inventory/service").then((m) =>
      m.applyFilamentDeltas(movements),
    ),
  restoreByRef: (reason, refId) =>
    import("@/features/inventory/service").then((m) =>
      m.restoreFilamentMovements(reason, refId),
    ),
  audit: recordAudit,
};

// resolveFilamentForItem es puro pero vive en inventory: se resuelve perezoso
// para que importar ESTE módulo no arrastre la cadena de inventory de entrada.
async function resolveDefault(): Promise<
  NonNullable<OrderInventoryDeps["resolveFilament"]>
> {
  const m = await import("@/features/inventory/service");
  return m.resolveFilamentForItem;
}

export type DeductResult = {
  deducted: number; // líneas que descontaron
  skipped: Array<{ item: string; reason: string }>;
};

/**
 * Descuenta el filamento de TODAS las líneas de un pedido (una sola tx en el
 * repository de inventory). No lanza: cualquier error queda en consola y en
 * auditoría — el pedido ya se confirmó y la venta no se bloquea (regla firme).
 */
export async function deductFilamentForOrder(
  orderId: string,
  deps: OrderInventoryDeps = defaultDeps,
): Promise<DeductResult> {
  const result: DeductResult = { deducted: 0, skipped: [] };
  try {
    if (await deps.hasMovements("order", orderId)) return result; // ya corrió

    const order = await deps.getOrder(orderId);
    if (!order) return result;

    const resolve = deps.resolveFilament ?? (await resolveDefault());
    const filaments = await deps.listFilaments();
    const movements: NewFilamentMovement[] = [];

    for (const item of order.items) {
      const label = `${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""}`;
      if (!item.productId) {
        result.skipped.push({ item: label, reason: "producto borrado" });
        continue;
      }
      const specs = await deps.getProductSpecs(item.productId);
      if (!specs?.material) {
        result.skipped.push({ item: label, reason: "producto sin material" });
        continue;
      }
      if (!specs.weightGrams || specs.weightGrams <= 0) {
        result.skipped.push({ item: label, reason: "producto sin peso (g)" });
        continue;
      }
      const filament = resolve(filaments, {
        material: specs.material,
        variantLabel: item.variantLabel,
      });
      if (!filament) {
        result.skipped.push({
          item: label,
          reason: `sin filamento ${specs.material} para el color elegido`,
        });
        continue;
      }
      movements.push({
        filamentId: filament.id,
        material: filament.material,
        color: filament.color,
        deltaGrams: -(specs.weightGrams * item.quantity),
        reason: "order",
        refId: orderId,
      });
    }

    if (movements.length > 0) {
      await deps.applyDeltas(movements);
      result.deducted = movements.length;
    }

    if (result.skipped.length > 0) {
      console.warn(
        `[inventario] pedido ${orderId}: líneas sin descuento de filamento`,
        result.skipped,
      );
      await deps.audit({
        actorId: null,
        action: "inventory.order_deduct_partial",
        entityType: "order",
        entityId: orderId,
        metadata: { skipped: result.skipped, deducted: result.deducted },
      });
    }
  } catch (error) {
    // El stock queda para ajuste manual; la venta no se bloquea.
    console.error(
      `[inventario] no se pudo descontar filamento del pedido ${orderId}:`,
      error,
    );
    await deps
      .audit({
        actorId: null,
        action: "inventory.order_deduct_failed",
        entityType: "order",
        entityId: orderId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => undefined);
  }
  return result;
}

/**
 * Repone lo que el pedido había descontado (cancelación, reembolso o borrado).
 * Idempotente (si nunca descontó o ya se repuso, no hace nada). No lanza.
 */
export async function restoreFilamentForOrder(
  orderId: string,
  deps: OrderInventoryDeps = defaultDeps,
): Promise<number> {
  try {
    return await deps.restoreByRef("order", orderId);
  } catch (error) {
    console.error(
      `[inventario] no se pudo reponer el filamento del pedido ${orderId}:`,
      error,
    );
    await deps
      .audit({
        actorId: null,
        action: "inventory.order_restore_failed",
        entityType: "order",
        entityId: orderId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => undefined);
    return 0;
  }
}
