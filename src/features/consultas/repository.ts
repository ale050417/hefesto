import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { inquiries } from "@/core/db/schema";
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
