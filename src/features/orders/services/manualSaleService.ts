import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { manualSales } from "@/core/db/schema";
import { recordAudit } from "@/core/audit";
import type {
  Filament,
  LowStockFilament,
  NewFilamentMovement,
} from "@/features/inventory/types";
import { notifyLowStockAfterSale } from "@/features/inventory/lowStockNotify";
import type { ManualSaleInput } from "../schemas";
import type { OrderStatus } from "../types";
import { canTransition } from "../transitions";
import { ValidationError } from "@/core/errors";

export type ManualSale = typeof manualSales.$inferSelect;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Estados donde la venta YA está cobrada y consumió stock: desde "confirmado" en
// adelante (mismo criterio que la facturación/reparto). El filamento se descuenta
// al ENTRAR a uno de estos; salir a cancelado/reembolsado repone.
const REVENUE_STATUSES: OrderStatus[] = [
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

/**
 * Qué hacer con el stock al cambiar de estado una venta (PURO, testeable):
 * - "deduct": al ENTRAR a "confirmado+" (la venta pasa a estar cobrada).
 * - "restore": al pasar a cancelado/reembolsado (se revierte lo consumido).
 * - "none": el resto (avances entre estados ya cobrados, o entre no cobrados).
 * La idempotencia real la garantiza el ledger de filamento.
 */
export function stockActionForTransition(
  from: OrderStatus,
  to: OrderStatus,
): "deduct" | "restore" | "none" {
  const wasRevenue = REVENUE_STATUSES.includes(from);
  const isRevenue = REVENUE_STATUSES.includes(to);
  if (!wasRevenue && isRevenue) return "deduct";
  if (to === "cancelled" || to === "refunded") return "restore";
  return "none";
}

/**
 * Costos de la venta completa a partir del costo UNITARIO y la cantidad.
 * Puro y testeable (Cap. 15: toca dinero). La calculadora cotiza UNA pieza;
 * acá se escala: amortización total = unitaria × cantidad; ganancia = total −
 * amortización total (nunca negativa).
 */
export function computeManualSaleCosts(params: {
  unitAmortization: number;
  total: number;
  quantity: number;
}): { amortization: number; profit: number } {
  const qty = Math.max(1, Math.floor(params.quantity));
  const amortization = round2(Math.max(0, params.unitAmortization) * qty);
  const profit = round2(Math.max(0, params.total - amortization));
  return { amortization, profit };
}

/**
 * Mapea la entrada validada (Zod) a la fila de la base. Puro y testeable.
 * El total se guarda como string con 2 decimales (numeric). La fecha del input
 * (YYYY-MM-DD) se interpreta a mediodía local para evitar saltos de día por TZ.
 */
export function toManualSaleRow(
  input: ManualSaleInput,
  createdBy: string | null,
): typeof manualSales.$inferInsert {
  return {
    saleDate: new Date(`${input.saleDate}T12:00:00`),
    customerName: input.customerName,
    detail: input.detail ?? null,
    category: input.category ?? null,
    quantity: input.quantity,
    total: input.total.toFixed(2),
    amortization:
      input.amortization != null ? input.amortization.toFixed(2) : null,
    profit: input.profit != null ? input.profit.toFixed(2) : null,
    paymentMethod: input.paymentMethod,
    status: input.status,
    // Reparto de esta venta (solo partes con % > 0). Null = dividir por socios actuales.
    profitSplit:
      input.profitSplit && input.profitSplit.length > 0
        ? input.profitSplit.filter((p) => p.pct > 0)
        : null,
    // Stock (Bloque C): qué filamento consume la venta, para descontar al
    // confirmar (ya no al crear). Nullable si la carga no trae ese dato.
    filamentId: input.filamentId || null,
    grams: input.grams != null ? String(input.grams) : null,
    colorLines:
      input.colorLines && input.colorLines.length > 0 ? input.colorLines : null,
    createdBy,
  };
}

export async function createManualSale(
  input: ManualSaleInput,
  createdBy: string | null,
): Promise<ManualSale> {
  const [row] = await db
    .insert(manualSales)
    .values(toManualSaleRow(input, createdBy))
    .returning();
  if (!row) throw new Error("No se pudo registrar la venta manual");
  // Stock (Bloque C): solo se descuenta si la venta NACE cobrada (confirmado+),
  // por ejemplo una importación de venta ya entregada. Si nace pendiente (flujo
  // normal del form), el descuento ocurre al CONFIRMAR (updateManualSaleStatus).
  // No bloquea la venta: la función atrapa sus errores y deja warning en auditoría.
  if (REVENUE_STATUSES.includes(row.status)) {
    await deductFilamentForManualSale(row.id, input);
  }
  return row;
}

// --- Descuento de filamento por venta manual (diseño 2026-07) ---

export type ManualSaleStockDeps = {
  listFilaments: () => Promise<Filament[]>;
  hasMovements: (reason: "manual_sale", refId: string) => Promise<boolean>;
  applyDeltas: (
    movements: NewFilamentMovement[],
  ) => Promise<LowStockFilament[]>;
  /** Aviso best-effort cuando la venta deja colores en/bajo el umbral.
   * Opcional: por defecto notifica al panel. */
  notifyLowStock?: (items: LowStockFilament[]) => Promise<void>;
  /** Matching puro (inventory). Si no se inyecta, se resuelve perezoso. */
  resolveFilament?: (
    filaments: Filament[],
    params: { filamentId?: string | null; material?: string | null },
  ) => Filament | null;
  audit: typeof recordAudit;
};

const defaultStockDeps: ManualSaleStockDeps = {
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
  audit: recordAudit,
};

/**
 * Descuenta del inventario los gramos de una venta manual: gramos (por unidad,
 * los de la calculadora) × cantidad, del filamento elegido por id — o por
 * material SOLO si hay un único filamento de ese material (no se adivina).
 * Reglas firmes: nunca bloquea la venta (atrapa todo y deja warning en
 * auditoría) y es idempotente vía ledger (reason 'manual_sale' + ref_id).
 * Si la carga no trae gramos ni filamento/material, no hay intención de
 * descontar (cargas viejas/histórico): se saltea en silencio.
 */
export async function deductFilamentForManualSale(
  saleId: string,
  input: Pick<
    ManualSaleInput,
    "filamentId" | "material" | "grams" | "quantity" | "colorLines"
  >,
  deps: ManualSaleStockDeps = defaultStockDeps,
): Promise<{ deducted: boolean; reason?: string }> {
  const hasIntent = Boolean(
    input.filamentId || input.material || (input.colorLines?.length ?? 0) > 0,
  );
  const grams = input.grams ?? 0;
  try {
    if (!hasIntent) return { deducted: false, reason: "sin filamento" };
    if (await deps.hasMovements("manual_sale", saleId)) {
      return { deducted: false, reason: "ya descontado" };
    }

    const warn = async (reason: string) => {
      console.warn(
        `[inventario] venta manual ${saleId}: sin descuento (${reason})`,
      );
      await deps.audit({
        actorId: null,
        action: "inventory.manual_sale_no_deduct",
        entityType: "manual_sale",
        entityId: saleId,
        metadata: {
          reason,
          filamentId: input.filamentId ?? null,
          material: input.material ?? null,
          grams,
        },
      });
      return { deducted: false, reason };
    };

    // MULTICOLOR: descuenta cada color de su carrete (varios movimientos). Si un
    // color pide más de lo que hay, applyDeltas lo reporta (shortfall) y se avisa.
    const lines = input.colorLines ?? [];
    if (lines.length > 0) {
      const qtyM = Math.max(1, Math.floor(input.quantity));
      const fils = await deps.listFilaments();
      const movements = lines
        .map((ln): NewFilamentMovement | null => {
          const f = fils.find((x) => x.id === ln.filamentId);
          if (!f || !(ln.grams > 0)) return null;
          return {
            filamentId: f.id,
            material: f.material,
            color: f.color,
            deltaGrams: -(ln.grams * qtyM),
            reason: "manual_sale" as const,
            refId: saleId,
          };
        })
        .filter((m): m is NewFilamentMovement => m !== null);
      if (movements.length === 0) return warn("colores sin filamento/gramos");
      const lowM = await deps.applyDeltas(movements);
      if (lowM.length > 0) {
        const notify = deps.notifyLowStock ?? notifyLowStockAfterSale;
        await notify(lowM).catch(() => undefined);
      }
      return { deducted: true };
    }

    if (!(grams > 0)) return warn("sin gramos");

    const resolve: NonNullable<ManualSaleStockDeps["resolveFilament"]> =
      deps.resolveFilament ??
      (await import("@/features/inventory/service").then(
        (m) => m.resolveFilamentForManualSale,
      ));
    const filament = resolve(await deps.listFilaments(), {
      filamentId: input.filamentId ?? null,
      material: input.material ?? null,
    });
    if (!filament) {
      return warn(
        input.filamentId
          ? "el filamento elegido ya no existe"
          : `material "${input.material}" sin filamento único`,
      );
    }

    const qty = Math.max(1, Math.floor(input.quantity));
    const low = await deps.applyDeltas([
      {
        filamentId: filament.id,
        material: filament.material,
        color: filament.color,
        deltaGrams: -(grams * qty),
        reason: "manual_sale",
        refId: saleId,
      },
    ]);
    if (low.length > 0) {
      const notify = deps.notifyLowStock ?? notifyLowStockAfterSale;
      await notify(low).catch(() => undefined);
    }
    return { deducted: true };
  } catch (error) {
    console.error(
      `[inventario] no se pudo descontar filamento de la venta ${saleId}:`,
      error,
    );
    await deps
      .audit({
        actorId: null,
        action: "inventory.manual_sale_deduct_failed",
        entityType: "manual_sale",
        entityId: saleId,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => undefined);
    return { deducted: false, reason: "error" };
  }
}

export async function listManualSales(): Promise<ManualSale[]> {
  return db.query.manualSales.findMany({
    orderBy: (m, { desc }) => [desc(m.saleDate)],
  });
}

/**
 * Cambia el estado de una venta manual respetando la MÁQUINA DE ESTADOS (Bloque
 * C): mismas transiciones que un pedido; cancelado/reembolsado son terminales.
 * Además dispara el stock: al ENTRAR a "confirmado+" descuenta el filamento
 * guardado (idempotente), y al pasar a cancelado/reembolsado repone. Qué cuenta
 * como facturación/reparto lo deciden reportes y ganancias por estado (desde
 * confirmado). La autorización se valida en la action.
 */
export async function updateManualSaleStatus(
  id: string,
  status: ManualSale["status"],
): Promise<void> {
  const sale = await db.query.manualSales.findFirst({
    where: eq(manualSales.id, id),
  });
  if (!sale) throw new ValidationError("No encontramos la venta.");
  if (sale.status === status) return; // sin cambios
  if (!canTransition(sale.status, status)) {
    throw new ValidationError(
      `No se puede pasar de "${sale.status}" a "${status}".`,
    );
  }
  await db.update(manualSales).set({ status }).where(eq(manualSales.id, id));

  // Hooks de stock: entrar a "confirmado+" descuenta el filamento persistido en
  // la venta; pasar a cancelado/reembolsado repone. Idempotente vía ledger.
  const action = stockActionForTransition(sale.status, status);
  if (action === "deduct") {
    await deductFilamentForManualSale(id, {
      filamentId: sale.filamentId ?? undefined,
      material: undefined,
      grams: sale.grams != null ? Number(sale.grams) : 0,
      quantity: sale.quantity,
      colorLines: sale.colorLines ?? undefined,
    });
  } else if (action === "restore") {
    const { restoreFilamentMovements } =
      await import("@/features/inventory/service");
    await restoreFilamentMovements("manual_sale", id).catch(() => 0);
  }
}

/**
 * Borra una venta manual (cargada mal / duplicada). Antes de borrar, REPONE el
 * filamento que la venta había descontado (compensatorio 'restore' en el
 * ledger, idempotente) — el inventario siempre refleja la realidad, misma
 * regla que el borrado de fallas. La reposición va primero: si el delete
 * falla, el reintento no repone dos veces. La autorización (solo admin) se
 * valida en la action.
 */
export async function deleteManualSale(id: string): Promise<void> {
  const { restoreFilamentMovements } =
    await import("@/features/inventory/service");
  await restoreFilamentMovements("manual_sale", id).catch((error) => {
    // No bloquea el borrado: queda para ajuste manual (y trazado en consola).
    console.error(
      `[inventario] no se pudo reponer el filamento de la venta ${id}:`,
      error,
    );
    return 0;
  });
  await db.delete(manualSales).where(eq(manualSales.id, id));
}
