import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  inquiries,
  inquiryMessages,
  inquiryReads,
  manualSales,
} from "@/core/db/schema";
import type { InquiryStatus } from "./schemas";

export type Inquiry = typeof inquiries.$inferSelect;

/** Las más nuevas primero. */
export async function listInquiries(limit = 300): Promise<Inquiry[]> {
  return db
    .select()
    .from(inquiries)
    .orderBy(desc(inquiries.createdAt))
    .limit(limit);
}

export async function findInquiryById(id: string): Promise<Inquiry | null> {
  const [row] = await db
    .select()
    .from(inquiries)
    .where(eq(inquiries.id, id))
    .limit(1);
  return row ?? null;
}

/** Sin cerrar: esperan al operador o al cliente (contador del menú). */
export async function countOpenInquiries(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(inArray(inquiries.status, ["pending", "answered"]));
  return row?.n ?? 0;
}

export async function insertInquiry(values: {
  customerName: string;
  customerPhone: string | null;
  title: string;
  description: string;
  quantity: number;
  createdBy: string | null;
  createdByName: string | null;
}): Promise<Inquiry> {
  const [row] = await db.insert(inquiries).values(values).returning();
  return row!;
}

/** Suma una foto; el tope se chequea en la misma sentencia. */
export async function appendInquiryImage(
  id: string,
  url: string,
  max: number,
): Promise<boolean> {
  const rows = await db
    .update(inquiries)
    .set({
      images: sql`${inquiries.images} || ${JSON.stringify([url])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inquiries.id, id),
        sql`jsonb_array_length(${inquiries.images}) < ${max}`,
      ),
    )
    .returning({ id: inquiries.id });
  return rows.length > 0;
}

export async function saveInquiryAnswer(
  id: string,
  values: {
    unitPrice: number;
    unitCost: number | null;
    estFilamentId: string | null;
    estMaterial: string | null;
    estGrams: number | null;
    estMinutes: number | null;
    bulkPrice: number | null;
    bulkFrom: number | null;
    dimensions: string | null;
    colors: string | null;
    deliveryTime: string | null;
    answerNote: string | null;
    message: string;
    answeredBy: string | null;
    answeredByName: string | null;
  },
): Promise<Inquiry | null> {
  const [row] = await db
    .update(inquiries)
    .set({
      ...values,
      unitPrice: values.unitPrice.toFixed(2),
      unitCost: values.unitCost == null ? null : values.unitCost.toFixed(2),
      estGrams: values.estGrams == null ? null : values.estGrams.toFixed(2),
      estMinutes:
        values.estMinutes == null ? null : Math.round(values.estMinutes),
      bulkPrice: values.bulkPrice == null ? null : values.bulkPrice.toFixed(2),
      status: "answered",
      answeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inquiries.id, id),
        inArray(inquiries.status, ["pending", "answered"]),
      ),
    )
    .returning();
  return row ?? null;
}

/** Suma un adjunto (audio, PDF…); el tope va en la misma sentencia. */
export async function appendInquiryFile(
  id: string,
  file: { url: string; name: string; type: string },
  max: number,
): Promise<boolean> {
  const rows = await db
    .update(inquiries)
    .set({
      files: sql`${inquiries.files} || ${JSON.stringify([file])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(inquiries.id, id),
        sql`jsonb_array_length(${inquiries.files}) < ${max}`,
      ),
    )
    .returning({ id: inquiries.id });
  return rows.length > 0;
}

/**
 * Toma la consulta para confirmarla: pasa de "answered" a "confirmed" en UNA
 * sentencia. Dos toques seguidos en "Confirmado" no pueden crear dos pedidos:
 * solo el primero recibe la fila.
 */
export async function claimInquiryConfirmation(
  id: string,
): Promise<Inquiry | null> {
  const [row] = await db
    .update(inquiries)
    .set({
      status: "confirmed",
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(inquiries.id, id), eq(inquiries.status, "answered")))
    .returning();
  return row ?? null;
}

export async function setInquirySale(
  id: string,
  saleId: string,
): Promise<Inquiry | null> {
  const [row] = await db
    .update(inquiries)
    .set({ saleId, updatedAt: new Date() })
    .where(eq(inquiries.id, id))
    .returning();
  return row ?? null;
}

export async function setInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<Inquiry | null> {
  const [row] = await db
    .update(inquiries)
    .set({
      status,
      confirmedAt: status === "confirmed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(inquiries.id, id))
    .returning();
  return row ?? null;
}

export async function deleteInquiryRow(id: string): Promise<void> {
  await db.delete(inquiries).where(eq(inquiries.id, id));
}

/** Cómo paga el cliente: se sabe recién cuando seña (el pedido ya existe). */
export async function setSalePaymentMethod(
  saleId: string,
  paymentMethod: "transfer" | "mercadopago" | "cash",
): Promise<void> {
  await db
    .update(manualSales)
    .set({ paymentMethod })
    .where(eq(manualSales.id, saleId));
}

// --- Chat de la consulta (0086) ---

export type InquiryMessage = typeof inquiryMessages.$inferSelect;

/** Tope de mensajes que se traen de una conversación (los últimos). */
const CHAT_PAGE = 300;

/** Mensajes en orden; con `after`, solo los posteriores a esa fecha. */
export async function listInquiryMessages(
  inquiryId: string,
  after?: Date | null,
): Promise<InquiryMessage[]> {
  const rows = await db
    .select()
    .from(inquiryMessages)
    .where(
      and(
        eq(inquiryMessages.inquiryId, inquiryId),
        after ? gt(inquiryMessages.createdAt, after) : undefined,
      ),
    )
    .orderBy(desc(inquiryMessages.createdAt), desc(inquiryMessages.id))
    .limit(CHAT_PAGE);
  return rows.reverse();
}

export async function insertInquiryMessage(values: {
  inquiryId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  image: string | null;
}): Promise<InquiryMessage> {
  const [row] = await db.insert(inquiryMessages).values(values).returning();
  return row!;
}

/** Marca la conversación como leída por esta persona (hasta ahora). */
export async function markInquiryRead(
  inquiryId: string,
  profileId: string,
): Promise<void> {
  const readAt = new Date();
  await db
    .insert(inquiryReads)
    .values({ inquiryId, profileId, readAt })
    .onConflictDoUpdate({
      target: [inquiryReads.inquiryId, inquiryReads.profileId],
      set: { readAt },
    });
}

export type ChatSummary = { messages: number; unread: number };

/**
 * Por consulta: cuántos mensajes tiene y cuántos le faltan leer a esta
 * persona (los de otros, posteriores a su última lectura). Una sola consulta
 * a la base para toda la lista.
 */
export async function chatSummaries(
  viewerId: string | null,
): Promise<Map<string, ChatSummary>> {
  const viewer = viewerId ?? "00000000-0000-0000-0000-000000000000";
  const rows = await db
    .select({
      inquiryId: inquiryMessages.inquiryId,
      messages: sql<number>`count(*)::int`,
      unread: sql<number>`count(*) filter (where ${inquiryMessages.authorId} is distinct from ${viewer}::uuid and (${inquiryReads.readAt} is null or ${inquiryMessages.createdAt} > ${inquiryReads.readAt}))::int`,
    })
    .from(inquiryMessages)
    .leftJoin(
      inquiryReads,
      and(
        eq(inquiryReads.inquiryId, inquiryMessages.inquiryId),
        eq(inquiryReads.profileId, viewer),
      ),
    )
    .groupBy(inquiryMessages.inquiryId);
  return new Map(
    rows.map((r) => [r.inquiryId, { messages: r.messages, unread: r.unread }]),
  );
}

/** Fotos del chat de una consulta (para borrarlas del storage con ella). */
export async function listInquiryChatImages(
  inquiryId: string,
): Promise<string[]> {
  const rows = await db
    .select({ image: inquiryMessages.image })
    .from(inquiryMessages)
    .where(eq(inquiryMessages.inquiryId, inquiryId))
    .orderBy(asc(inquiryMessages.createdAt));
  return rows.map((r) => r.image).filter((u): u is string => !!u);
}
