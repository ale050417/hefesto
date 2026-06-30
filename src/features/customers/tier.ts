// Categoría del cliente (tier). El index la trata como dato manual; acá la
// derivamos automáticamente del historial real (gasto + cantidad de pedidos).
// Módulo puro (sin DB) para poder testearlo.

export type CustomerTier = "gold" | "silver" | "bronze";

// Umbrales (ARS gastado o cantidad de pedidos). Ajustables en un solo lugar.
export const TIER_THRESHOLDS = {
  gold: { spent: 150_000, orders: 10 },
  silver: { spent: 40_000, orders: 3 },
} as const;

export function computeTier(spent: number, orders: number): CustomerTier {
  if (
    spent >= TIER_THRESHOLDS.gold.spent ||
    orders >= TIER_THRESHOLDS.gold.orders
  )
    return "gold";
  if (
    spent >= TIER_THRESHOLDS.silver.spent ||
    orders >= TIER_THRESHOLDS.silver.orders
  )
    return "silver";
  return "bronze";
}

// Etiquetas y clases visuales tal cual el index.
export const TIER_LABEL: Record<CustomerTier, string> = {
  gold: "VIP",
  silver: "Frecuente",
  bronze: "Nuevo",
};

export const TIER_BADGE_CLASS: Record<CustomerTier, string> = {
  gold: "badge-gold",
  silver: "badge-info",
  bronze: "badge-warning",
};
