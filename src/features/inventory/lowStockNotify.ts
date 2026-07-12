import type { LowStockFilament } from "./types";

/**
 * Aviso al panel: una VENTA (online o manual) dejó uno o más colores en/bajo el
 * umbral de alerta. Best-effort (no bloquea la venta). Antes el aviso salía solo
 * al registrar una falla; ahora también al vender (pedido 2026-07-11).
 */
export async function notifyLowStockAfterSale(
  items: LowStockFilament[],
  kind: "venta" | "falla" = "venta",
): Promise<void> {
  if (items.length === 0) return;
  const { notifyAdmins } = await import("@/features/notifications/service");
  const fmt = (arr: LowStockFilament[]) =>
    arr.map((i) => `${i.material} ${i.color}`).join(", ");
  const short = items.filter((i) => i.shortfall);
  const low = items.filter((i) => !i.shortfall);
  const parts: string[] = [];
  if (short.length)
    parts.push(`Faltó stock (conviene COMPRAR filamento): ${fmt(short)}`);
  if (low.length) parts.push(`Quedó bajo el umbral: ${fmt(low)}`);
  const origin = kind === "falla" ? "una falla" : "una venta";
  await notifyAdmins({
    title: short.length
      ? "Falta filamento para reponer"
      : "Stock bajo de filamento",
    body: `${parts.join(". ")}. (por ${origin})`,
    link: "/admin/filamentos",
  });
}
