import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { profiles } from "@/core/db/schema";
import type { Profile } from "./types";

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
