import type { filaments, printFailures } from "@/core/db/schema";

export type Filament = typeof filaments.$inferSelect;
export type PrintFailure = typeof printFailures.$inferSelect;

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
