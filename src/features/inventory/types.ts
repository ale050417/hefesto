import type {
  filamentMovements,
  filaments,
  printFailures,
} from "@/core/db/schema";

export type Filament = typeof filaments.$inferSelect;
export type PrintFailure = typeof printFailures.$inferSelect;

// Ledger de movimientos de filamento (ventas ↔ stock).
export type FilamentMovement = typeof filamentMovements.$inferSelect;
export type FilamentMovementReason =
  | "order"
  | "manual_sale"
  | "failure"
  | "adjust"
  | "restore";

/** Movimiento a aplicar: el delta REAL lo determina el repository (cap en 0). */
export type NewFilamentMovement = {
  filamentId: string;
  material: string;
  color: string;
  /** Gramos pedidos: negativo = consumo, positivo = reposición. */
  deltaGrams: number;
  reason: FilamentMovementReason;
  refId: string | null;
};

export type FilamentView = {
  id: string;
  material: string;
  color: string;
  brand: string;
  diameter: string;
  stockGrams: number;
  spoolGrams: number;
  costPerKg: number;
  alertThresholdGrams: number;
  lowStock: boolean;
  status: "ok" | "bajo" | "agotado";
};

/** Filamento que quedó en/bajo el umbral tras una baja (venta/falla). */
export type LowStockFilament = {
  filamentId: string;
  material: string;
  color: string;
  stockGrams: number;
  threshold: number;
  /** true = se pidió MÁS de lo que había (quedó en 0): falta filamento. */
  shortfall?: boolean;
};
