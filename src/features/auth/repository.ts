import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { profiles } from "@/core/db/schema";

type Database = typeof db;

// Nota: getProfileById se movió a core/auth/profile (lo necesita la sesión y
// core no puede importar features — Cap. 5/19). Auditoría 2026-07, I6.

/** Rol del perfil (para decidir el destino tras el login: staff → /admin). */
export async function getProfileRoleById(
  id: string,
  database: Database = db,
): Promise<string | null> {
  const [row] = await database
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  return row?.role ?? null;
}

/** Quita la marca de "cambiar contraseña en el primer ingreso". */
export async function clearMustChangePassword(
  id: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(profiles)
    .set({ mustChangePassword: false })
    .where(eq(profiles.id, id));
}
