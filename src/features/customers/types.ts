import type {
  addresses,
  manualCustomers,
  orders,
  profiles,
} from "@/core/db/schema";

export type Address = typeof addresses.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type ManualCustomer = typeof manualCustomers.$inferSelect;
