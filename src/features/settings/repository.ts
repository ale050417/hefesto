import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { businessSettings } from "@/core/db/schema";
import type { BusinessSettings } from "./types";

type Database = typeof db;
const SINGLETON_ID = 1;

export async function getSettings(
  database: Database = db,
): Promise<BusinessSettings | null> {
  const row = await database.query.businessSettings.findFirst({
    where: eq(businessSettings.id, SINGLETON_ID),
  });
  return row ?? null;
}

export async function upsertSettings(
  patch: Partial<Pick<BusinessSettings, "logoUrl" | "heroImageUrl">>,
  database: Database = db,
): Promise<BusinessSettings> {
  const [row] = await database
    .insert(businessSettings)
    .values({ id: SINGLETON_ID, ...patch })
    .onConflictDoUpdate({ target: businessSettings.id, set: patch })
    .returning();
  if (!row) throw new Error("No se pudo guardar la configuración");
  return row;
}
