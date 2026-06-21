import type { reviews } from "@/core/db/schema";
export type Review = typeof reviews.$inferSelect;
export type ReviewStats = { average: number; count: number };
