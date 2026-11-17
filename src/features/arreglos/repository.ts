import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { fixRequests, profiles } from "@/core/db/schema";
import type { FixStatus } from "./schemas";

export type FixRequest = typeof fixRequests.$inferSelect;

/** Los más nuevos primero. Tope alto: es una lista de trabajo, no un histórico. */
export async function listFixes(limit = 300): Promise<FixRequest[]> {
  return db
    .select()
    .from(fixRequests)
    .orderBy(desc(fixRequests.createdAt))
    .limit(limit);
}

export async function findFixById(id: string): Promise<FixRequest | null> {
  const [row] = await db
    .select()
    .from(fixRequests)
    .where(eq(fixRequests.id, id))
    .limit(1);
  return row ?? null;
}

/** Cuántos faltan resolver (contador del menú). */
export async function countOpenFixes(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(fixRequests)
    .where(ne(fixRequests.status, "done"));
  return row?.n ?? 0;
}

export async function insertFix(values: {
  title: string;
  description: string;
  urgent: boolean;
  createdBy: string | null;
  createdByName: string | null;
}): Promise<FixRequest> {
  const [row] = await db.insert(fixRequests).values(values).returning();
  return row!;
}

/**
 * Suma una foto. El tope se chequea EN la misma sentencia: dos subidas a la
 * vez no pueden pasarse del máximo. Devuelve false si ya no entraba (o si el
 * arreglo no existe).
 */
export async function appendFixImage(
  id: string,
  url: string,
  max: number,
): Promise<boolean> {
  const rows = await db
    .update(fixRequests)
    .set({
      images: sql`${fixRequests.images} || ${JSON.stringify([url])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fixRequests.id, id),
        sql`jsonb_array_length(${fixRequests.images}) < ${max}`,
      ),
    )
    .returning({ id: fixRequests.id });
  return rows.length > 0;
}

export async function updateFixStatus(
  id: string,
  values: { status: FixStatus; ownerNote: string | null },
): Promise<FixRequest | null> {
  const [row] = await db
    .update(fixRequests)
    .set({
      status: values.status,
      ownerNote: values.ownerNote,
      resolvedAt: values.status === "done" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(fixRequests.id, id))
    .returning();
  return row ?? null;
}

export async function deleteFixRow(id: string): Promise<void> {
  await db.delete(fixRequests).where(eq(fixRequests.id, id));
}

/** Ids de las cuentas dueñas (enum admin), para avisarles por correo. */
export async function listOwnerIds(): Promise<string[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "admin"));
  return rows.map((r) => r.id);
}
