import type { customMessages, customRequests } from "@/core/db/schema";

export type CustomRequest = typeof customRequests.$inferSelect;
export type CustomMessage = typeof customMessages.$inferSelect;
export type CustomRequestStatus = CustomRequest["status"];
