import type { addresses, profiles } from "@/core/db/schema";

export type Address = typeof addresses.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
