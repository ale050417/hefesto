import { and, desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { notifications } from "@/core/db/schema";

type Database = typeof db;
export type Notification = typeof notifications.$inferSelect;

// --- Cliente (audience 'customer') ---

export async function listByCustomer(
  customerId: string,
  limit = 20,
  database: Database = db,
): Promise<Notification[]> {
  return database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.audience, "customer"),
      ),
    )
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
        eq(notifications.audience, "customer"),
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
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.audience, "customer"),
      ),
    );
}

// --- Admin (audience 'admin', broadcast al staff) ---

export async function listForAdmin(
  limit = 20,
  database: Database = db,
): Promise<Notification[]> {
  return database
    .select()
    .from(notifications)
    .where(eq(notifications.audience, "admin"))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnreadAdmin(
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.audience, "admin"), eq(notifications.isRead, false)),
    );
  return rows.length;
}

export async function markAllReadAdmin(database: Database = db): Promise<void> {
  await database
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.audience, "admin"), eq(notifications.isRead, false)),
    );
}

export async function insertNotification(
  values: typeof notifications.$inferInsert,
  database: Database = db,
): Promise<void> {
  await database.insert(notifications).values(values);
}
