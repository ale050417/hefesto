import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { manualSaleItems, manualSales } from "@/core/db/schema";
import { recordAudit } from "@/core/audit";
import type {
  Filament,
  LowStockFilament,
  NewFilamentMovement,
} from "@/features/inventory/types";
import { notifyLowStockAfterSale } from "@/features/inventory/lowStockNotify";
import type { ManualSaleInput, ManualSaleEditInput } from "../schemas";
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
 * Ganancia de una venta manual EDITADA a mano (fix insumos retroactivo): el costo
 * (amortización) ya es TOTAL e incluye material + insumos, así que NO se
 * multiplica por cantidad. Puro y testeable (toca dinero). Clampa igual que
 * earnings.manualSaleEconomics: ganancia = max(0, total − costo); costo ≥ 0.
 */
export function editedManualSaleEconomics(
  total: number,
  amortization: number,
): { amortization: number; profit: number } {
  const a = round2(Math.max(0, amortization));
  return { amortization: a, profit: round2(Math.max(0, total - a)) };
}

// --- Venta con VARIAS combinaciones de colores (2026-08-09, pedido de Ale) ---
//
// Caso real: 10 Dumplings vendidos, cada uno de una combinación distinta. Antes
// había que cargar 10 ventas. Ahora la venta lleva LÍNEAS adentro (una por
// combinación, con su cantidad) y el total/los gramos salen de sumarlas.
//
// Estos dos helpers son PUROS a propósito (Cap. 15: tocan plata y stock): la
// cuenta se puede probar sin base ni formulario.

/** Una combinación vendida: qué, cuántas, a cuánto y con qué gramos por color. */
export type ManualSaleLine = {
  variantLabel?: string | null;
  color?: string | null;
  quantity: number;
  unitPrice: number;
  /** Gramos por filamento de UNA unidad de esta combinación. */
  colorLines?: Array<{ filamentId: string; grams: number }>;
};

/**
 * Total cobrado y unidades de una venta con líneas.
 *
 * El total NO se carga a mano: es la suma de `precio × cantidad` de cada línea.
 * Cada línea se redondea a 2 decimales ANTES de sumar (igual que el pedido
 * online): así lo que se muestra por línea es exactamente lo que suma el total,
 * sin diferencias de un centavo al final.
 */
export function manualSaleTotals(lines: ManualSaleLine[]): {
  total: number;
  quantity: number;
} {
  let total = 0;
  let quantity = 0;
  for (const ln of lines) {
    const qty = Math.max(0, Math.floor(ln.quantity));
    if (qty <= 0) continue;
    total += round2(Math.max(0, ln.unitPrice) * qty);
    quantity += qty;
  }
  return { total: round2(total), quantity };
}

/**
 * Gramos TOTALES a descontar por filamento, sumando todas las líneas.
 *
 * Dos combinaciones distintas pueden compartir un color (ej. las dos llevan
 * rojo): tienen que terminar en UN solo movimiento de stock de ese carrete, no
 * en dos. Por eso se consolida por `filamentId`.
 *
 * Los gramos de cada línea ya vienen multiplicados por su propia cantidad, así
 * que el resultado es el consumo final de la venta: quien lo use debe descontar
 * tal cual (cantidad 1), sin volver a multiplicar.
 */
export function consolidateGrams(
  lines: ManualSaleLine[],
): Array<{ filamentId: string; grams: number }> {
  const byFilament = new Map<string, number>();
  for (const ln of lines) {
    const qty = Math.max(0, Math.floor(ln.quantity));
    if (qty <= 0) continue;
    for (const cl of ln.colorLines ?? []) {
      if (!cl.filamentId || !(cl.grams > 0)) continue;
      const acc = byFilament.get(cl.filamentId) ?? 0;
      byFilament.set(cl.filamentId, acc + cl.grams * qty);
    }
  }
  return [...byFilament.entries()].map(([filamentId, grams]) => ({
    filamentId,
    grams: round2(grams),
  }));
}

/**
 * Normaliza una venta CON líneas: el total, la cantidad y los gramos salen de
 * sumar las combinaciones, NO de lo que mandó el formulario (regla de dinero,
 * Cap. 11/14: el servidor recalcula, no confía en el cliente).
 *
 * Los `colorLines` que devuelve ya están multiplicados por la cantidad de cada
 * línea, así que representan el consumo TOTAL de la venta: al descontar stock
 * hay que usarlos con cantidad 1, sin volver a multiplicar (ver
 * `deductQuantityFor`). Puro y testeable.
 *
 * Sin líneas devuelve la entrada tal cual: la venta simple de siempre.
 */
export function applyManualSaleLines(input: ManualSaleInput): ManualSaleInput {
  const items = input.items ?? [];
  if (items.length === 0) return input;
  const { total, quantity } = manualSaleTotals(items);
  const grams = consolidateGrams(items);
  return {
    ...input,
    total,
    quantity: Math.max(1, quantity),
    colorLines: grams.length > 0 ? grams : undefined,
    // Los gramos ya van consolidados por carrete en `colorLines`; este campo
    // queda como total informativo de la venta.
    grams: grams.reduce((a, g) => a + g.grams, 0) || undefined,
    // El filamento "principal" pierde sentido con varias combinaciones: el
    // descuento real sale de colorLines.
    filamentId: grams[0]?.filamentId ?? input.filamentId,
  };
}

/**
 * Con qué cantidad descontar el stock. Con líneas los gramos guardados YA son
 * el total de la venta (`consolidateGrams` los multiplicó por línea), así que
 * multiplicar de nuevo por la cantidad de la venta descontaría de más — el bug
 * clásico de este cambio. Sin líneas, la cantidad de la venta manda, como antes.
 */
export function deductQuantityFor(params: {
  hasItems: boolean;
  quantity: number;
}): number {
  return params.hasItems ? 1 : Math.max(1, Math.floor(params.quantity));
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
    productId: input.productId ?? null,
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
  rawInput: ManualSaleInput,
  createdBy: string | null,
): Promise<ManualSale> {
  // Con varias combinaciones, el total/cantidad/gramos se recalculan acá desde
  // las líneas (el cliente no decide plata ni stock).
  const input = applyManualSaleLines(rawInput);
  const items = rawInput.items ?? [];

  // La venta y sus líneas van juntas o no van: una venta cuyo total salió de
  // líneas que no se guardaron sería un número sin respaldo.
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(manualSales)
      .values(toManualSaleRow(input, createdBy))
      .returning();
    if (!created) throw new Error("No se pudo registrar la venta manual");
    if (items.length > 0) {
      await tx.insert(manualSaleItems).values(
        items.map((it) => ({
          manualSaleId: created.id,
          variantLabel: it.variantLabel ?? null,
          color: it.color ?? null,
          quantity: it.quantity,
          unitPrice: it.unitPrice.toFixed(2),
          lineTotal: round2(it.unitPrice * it.quantity).toFixed(2),
          colorLines:
            it.colorLines && it.colorLines.length > 0 ? it.colorLines : null,
        })),
      );
    }
    return created;
  });

  // Stock (Bloque C): solo se descuenta si la venta NACE cobrada (confirmado+),
  // por ejemplo una importación de venta ya entregada. Si nace pendiente (flujo
  // normal del form), el descuento ocurre al CONFIRMAR (updateManualSaleStatus).
  // No bloquea la venta: la función atrapa sus errores y deja warning en auditoría.
  if (REVENUE_STATUSES.includes(row.status)) {
    await deductFilamentForManualSale(row.id, {
      ...input,
      quantity: deductQuantityFor({
        hasItems: items.length > 0,
        quantity: input.quantity,
      }),
    });
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

/** Una venta manual con su desglose por combinación (vacío = venta simple). */
export type ManualSaleWithItems = ManualSale & {
  items: (typeof manualSaleItems.$inferSelect)[];
};

export async function listManualSales(): Promise<ManualSaleWithItems[]> {
  // `items` viene para mostrar el desglose por combinación en el tablero
  // (2026-08-09). Las ventas simples lo traen vacío y se ven igual que antes.
  return db.query.manualSales.findMany({
    with: { items: true },
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
  reason?: string | null,
): Promise<void> {
  // `items` viene para saber si los gramos guardados ya son el total de la
  // venta (venta con varias combinaciones) o son por unidad (venta simple).
  const sale = await db.query.manualSales.findFirst({
    where: eq(manualSales.id, id),
    with: { items: true },
  });
  if (!sale) throw new ValidationError("No encontramos la venta.");
  if (sale.status === status) return; // sin cambios
  if (!canTransition(sale.status, status)) {
    throw new ValidationError(
      `No se puede pasar de "${sale.status}" a "${status}".`,
    );
  }
  await db
    .update(manualSales)
    .set({
      status,
      // Motivo al cancelar/reembolsar (opcional); en otras transiciones no toca.
      ...((status === "cancelled" || status === "refunded") && reason
        ? { cancelReason: reason }
        : {}),
    })
    .where(eq(manualSales.id, id));

  // Hooks de stock: entrar a "confirmado+" descuenta el filamento persistido en
  // la venta; pasar a cancelado/reembolsado repone. Idempotente vía ledger.
  const action = stockActionForTransition(sale.status, status);
  if (action === "deduct") {
    await deductFilamentForManualSale(id, {
      filamentId: sale.filamentId ?? undefined,
      material: undefined,
      grams: sale.grams != null ? Number(sale.grams) : 0,
      quantity: deductQuantityFor({
        hasItems: sale.items.length > 0,
        quantity: sale.quantity,
      }),
      colorLines: sale.colorLines ?? undefined,
    });
  } else if (action === "restore") {
    const { restoreFilamentMovements } =
      await import("@/features/inventory/service");
    await restoreFilamentMovements("manual_sale", id).catch(() => 0);
  }
}

/**
 * Edita SOLO números + metadatos de una venta manual ya cargada (fix insumos
 * retroactivo 2026-07): total, costo (amortización = material + insumos),
 * cliente, detalle, categoría, método y fecha. Recalcula la ganancia en el
 * servidor (no confía en el cliente). NO toca stock, estado ni filamento: esos
 * siguen su propio flujo (updateManualSaleStatus). Autorización en la action.
 */
export async function updateManualSale(
  id: string,
  input: ManualSaleEditInput,
): Promise<void> {
  const sale = await db.query.manualSales.findFirst({
    where: eq(manualSales.id, id),
  });
  if (!sale) throw new ValidationError("No encontramos la venta.");
  const { amortization, profit } = editedManualSaleEconomics(
    input.total,
    input.amortization,
  );
  await db
    .update(manualSales)
    .set({
      saleDate: new Date(`${input.saleDate}T12:00:00`),
      customerName: input.customerName,
      detail: input.detail ?? null,
      category: input.category ?? null,
      total: input.total.toFixed(2),
      amortization: amortization.toFixed(2),
      profit: profit.toFixed(2),
      paymentMethod: input.paymentMethod,
    })
    .where(eq(manualSales.id, id));
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
