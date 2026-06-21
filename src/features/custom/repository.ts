import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { customMessages, customRequests } from "@/core/db/schema";
import type { CustomMessage, CustomRequest } from "./types";

type Database = typeof db;

export async function createRequest(
  values: typeof customRequests.$inferInsert,
  database: Database = db,
): Promise<CustomRequest> {
  const [row] = await database
    .insert(customRequests)
    .values(values)
    .returning();
  if (!row) throw new Error("No se pudo crear la solicitud");
  return row;
}

export async function getRequestById(
  id: string,
  database: Database = db,
): Promise<CustomRequest | null> {
  const row = await database.query.customRequests.findFirst({
    where: eq(customRequests.id, id),
  });
  return row ?? null;
}

export async function listByCustomer(
  customerId: string,
  database: Database = db,
): Promise<CustomRequest[]> {
  return database.query.customRequests.findMany({
    where: eq(customRequests.customerId, customerId),
    orderBy: (r, { desc: d }) => [d(r.createdAt)],
  });
}

export async function listAll(
  database: Database = db,
): Promise<CustomRequest[]> {
  return database.query.customRequests.findMany({
    orderBy: (r, { desc: d }) => [d(r.createdAt)],
    limit: 200,
  });
}

export async function updateRequest(
  id: string,
  fields: Partial<typeof customRequests.$inferInsert>,
  database: Database = db,
): Promise<CustomRequest> {
  const [row] = await database
    .update(customRequests)
    .set(fields)
    .where(eq(customRequests.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar la solicitud");
  return row;
}

export async function listMessages(
  requestId: string,
  database: Database = db,
): Promise<CustomMessage[]> {
  return database
    .select()
    .from(customMessages)
    .where(eq(customMessages.requestId, requestId))
    .orderBy(customMessages.createdAt);
}

export async function addMessage(
  values: typeof customMessages.$inferInsert,
  database: Database = db,
): Promise<CustomMessage> {
  const [row] = await database
    .insert(customMessages)
    .values(values)
    .returning();
  if (!row) throw new Error("No se pudo enviar el mensaje");
  return row;
}
