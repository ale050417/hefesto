import type { LowStockFilament } from "./types";

/**
 * Aviso al panel: una VENTA (online o manual) dejó uno o más colores en/bajo el
 * umbral de alerta. Best-effort (no bloquea la venta). Antes el aviso salía solo
 * al registrar una falla; ahora también al vender (pedido 2026-07-11).
 */
export async function notifyLowStockAfterSale(
  items: LowStockFilament[],
): Promise<void> {
  if (items.length === 0) return;
  const { notifyAdmins } = await import("@/features/notifications/service");
  const list = items.map((i) => `${i.material} ${i.color}`).join(", ");
  await notifyAdmins({
    title: "Stock bajo de filamento",
    body: `Tras una venta, quedó en/bajo el umbral: ${list}. Conviene reponer.`,
    link: "/admin/filamentos",
  });
}
