import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/core/db";
import { customMessages, customRequests, profiles } from "@/core/db/schema";
import type { CustomMessage, CustomRequest } from "./types";

type Database = typeof db;

/** Fila del listado admin: la solicitud + datos del cliente + último mensaje. */
export type AdminRequestRow = CustomRequest & {
  customerName: string | null;
  customerPhone: string | null;
  lastMessage: {
    body: string;
    fromStaff: boolean;
    createdAt: Date;
  } | null;
};

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

/**
 * Listado para el panel: cada solicitud con el nombre/teléfono del cliente
 * y su último mensaje (para detectar "por responder"). Dos queries (no N+1).
 */
export async function listAllWithMeta(
  database: Database = db,
): Promise<AdminRequestRow[]> {
  const rows = await database
    .select({
      req: customRequests,
      customerName: profiles.fullName,
      customerPhone: profiles.phone,
    })
    .from(customRequests)
    .leftJoin(profiles, eq(profiles.id, customRequests.customerId))
    .orderBy(desc(customRequests.updatedAt))
    .limit(200);

  const ids = rows.map((r) => r.req.id);
  const lastByReq = new Map<string, AdminRequestRow["lastMessage"]>();
  if (ids.length > 0) {
    // Ordenado asc: el último write por request gana en el Map.
    const msgs = await database
      .select({
        requestId: customMessages.requestId,
        body: customMessages.body,
        fromStaff: customMessages.fromStaff,
        createdAt: customMessages.createdAt,
      })
      .from(customMessages)
      .where(inArray(customMessages.requestId, ids))
      .orderBy(customMessages.createdAt);
    for (const m of msgs) {
      lastByReq.set(m.requestId, {
        body: m.body,
        fromStaff: m.fromStaff,
        createdAt: m.createdAt,
      });
    }
  }

  return rows.map((r) => ({
    ...r.req,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    lastMessage: lastByReq.get(r.req.id) ?? null,
  }));
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

export async function deleteRequest(
  id: string,
  database: Database = db,
): Promise<void> {
  // Los custom_messages tienen FK con onDelete: "cascade".
  await database.delete(customRequests).where(eq(customRequests.id, id));
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
