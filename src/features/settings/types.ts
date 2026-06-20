import type { businessSettings } from "@/core/db/schema";

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type BrandSettings = {
  logoUrl: string | null;
  heroImageUrl: string | null;
};
