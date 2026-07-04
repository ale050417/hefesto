import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { profiles } from "@/core/db/schema";

// El perfil vive en core porque la SESIÓN lo necesita (rol para autorizar).
// Antes esto estaba en features/auth/repository, pero core no puede importar
// features (Cap. 5/19: "core nunca importa features"). Auditoría 2026-07, I6.

export type Profile = typeof profiles.$inferSelect;
export type UserRole = Profile["role"];

type Database = typeof db;

/** Trae el perfil (con su rol) por id de usuario. */
export async function getProfileById(
  id: string,
  database: Database = db,
): Promise<Profile | null> {
  const [row] = await database
    .select()
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return row ?? null;
}
