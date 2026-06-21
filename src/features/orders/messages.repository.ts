import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { orderMessages, orders } from "@/core/db/schema";

type Database = typeof db;
export type OrderMessage = typeof orderMessages.$inferSelect;

export async function listOrderMessages(
  orderId: string,
  database: Database = db,
): Promise<OrderMessage[]> {
  return database
    .select()
    .from(orderMessages)
    .where(eq(orderMessages.orderId, orderId))
    .orderBy(orderMessages.createdAt);
}

export async function addOrderMessage(
  values: typeof orderMessages.$inferInsert,
  database: Database = db,
): Promise<OrderMessage> {
  const [row] = await database.insert(orderMessages).values(values).returning();
  if (!row) throw new Error("No se pudo enviar el mensaje");
  return row;
}

export async function getOrderCustomerId(
  orderId: string,
  database: Database = db,
): Promise<string | null> {
  const row = await database.query.orders.findFirst({
    where: eq(orders.id, orderId),
    columns: { customerId: true },
  });
  return row?.customerId ?? null;
}
