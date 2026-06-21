import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { notifications } from "@/core/db/schema";

type Database = typeof db;
export type Notification = typeof notifications.$inferSelect;

export async function listByCustomer(
  customerId: string,
  limit = 20,
  database: Database = db,
): Promise<Notification[]> {
  return database
    .select()
    .from(notifications)
    .where(eq(notifications.customerId, customerId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(
  customerId: string,
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.isRead, false),
      ),
    );
  return rows.length;
}

export async function markAllRead(
  customerId: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.customerId, customerId));
}

export async function insertNotification(
  values: typeof notifications.$inferInsert,
  database: Database = db,
): Promise<void> {
  await database.insert(notifications).values(values);
}
