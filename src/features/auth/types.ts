import type { profiles } from "@/core/db/schema";

export type Profile = typeof profiles.$inferSelect;
export type UserRole = Profile["role"];
