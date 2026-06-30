import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  businessSettings,
  paymentSettings,
  profiles,
  roles,
  shippingSettings,
  storeBanners,
} from "@/core/db/schema";
import type {
  BusinessSettings,
  PaymentSettings,
  Role,
  ShippingSettings,
  StoreBanner,
  UserRow,
} from "./types";

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
  patch: Partial<Omit<typeof businessSettings.$inferInsert, "id">>,
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

/* ---------- Banners del hero ---------- */

export async function listBanners(
  database: Database = db,
): Promise<StoreBanner[]> {
  return database
    .select()
    .from(storeBanners)
    .orderBy(asc(storeBanners.sortOrder), asc(storeBanners.createdAt));
}

export async function listActiveBanners(
  database: Database = db,
): Promise<StoreBanner[]> {
  const rows = await database
    .select()
    .from(storeBanners)
    .where(eq(storeBanners.isActive, true))
    .orderBy(asc(storeBanners.sortOrder), asc(storeBanners.createdAt));
  return rows;
}

export async function insertBanner(
  values: typeof storeBanners.$inferInsert,
  database: Database = db,
): Promise<StoreBanner> {
  const [row] = await database.insert(storeBanners).values(values).returning();
  if (!row) throw new Error("No se pudo crear el banner");
  return row;
}

export async function updateBannerRow(
  id: string,
  fields: Partial<typeof storeBanners.$inferInsert>,
  database: Database = db,
): Promise<StoreBanner> {
  const [row] = await database
    .update(storeBanners)
    .set(fields)
    .where(eq(storeBanners.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el banner");
  return row;
}

export async function deleteBannerRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(storeBanners).where(eq(storeBanners.id, id));
}

/* ---------- Métodos de pago (singleton) ---------- */

export async function getPaymentSettings(
  database: Database = db,
): Promise<PaymentSettings | null> {
  const rows = await database
    .select()
    .from(paymentSettings)
    .where(eq(paymentSettings.id, 1));
  return rows[0] ?? null;
}

export async function upsertPaymentSettings(
  patch: Partial<Omit<typeof paymentSettings.$inferInsert, "id">>,
  database: Database = db,
): Promise<PaymentSettings> {
  const [row] = await database
    .insert(paymentSettings)
    .values({ id: 1, ...patch })
    .onConflictDoUpdate({ target: paymentSettings.id, set: patch })
    .returning();
  if (!row) throw new Error("No se pudo guardar los métodos de pago");
  return row;
}

/* ---------- Envíos (singleton) ---------- */

export async function getShippingSettings(
  database: Database = db,
): Promise<ShippingSettings | null> {
  const rows = await database
    .select()
    .from(shippingSettings)
    .where(eq(shippingSettings.id, 1));
  return rows[0] ?? null;
}

export async function upsertShippingSettings(
  patch: Partial<Omit<typeof shippingSettings.$inferInsert, "id">>,
  database: Database = db,
): Promise<ShippingSettings> {
  const [row] = await database
    .insert(shippingSettings)
    .values({ id: 1, ...patch })
    .onConflictDoUpdate({ target: shippingSettings.id, set: patch })
    .returning();
  if (!row) throw new Error("No se pudo guardar los envíos");
  return row;
}

/* ---------- Roles ---------- */

export async function listUserProfiles(
  database: Database = db,
): Promise<UserRow[]> {
  return database
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      role: profiles.role,
      roleId: profiles.roleId,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .orderBy(asc(profiles.role), asc(profiles.createdAt));
}

export async function countAdmins(database: Database = db): Promise<number> {
  const [r] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.role, "admin"));
  return r?.n ?? 0;
}

export async function getProfileRole(
  id: string,
  database: Database = db,
): Promise<UserRow["role"] | null> {
  const rows = await database
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, id));
  return rows[0]?.role ?? null;
}

export async function updateUserRole(
  id: string,
  role: UserRow["role"],
  database: Database = db,
): Promise<void> {
  await database.update(profiles).set({ role }).where(eq(profiles.id, id));
}

/** Setea enum de acceso + rol custom (asignación de rol a un miembro). */
export async function setProfileRole(
  id: string,
  role: UserRow["role"],
  roleId: string | null,
  database: Database = db,
): Promise<void> {
  await database
    .update(profiles)
    .set({ role, roleId })
    .where(eq(profiles.id, id));
}

/* ---------- Roles personalizados (CRUD) ---------- */

export async function listRoles(database: Database = db): Promise<Role[]> {
  return database
    .select()
    .from(roles)
    .orderBy(asc(roles.isSystem), asc(roles.createdAt));
}

export async function getRoleById(
  id: string,
  database: Database = db,
): Promise<Role | null> {
  const [row] = await database
    .select()
    .from(roles)
    .where(eq(roles.id, id))
    .limit(1);
  return row ?? null;
}

/** Crea un rol de sistema si no existe (idempotente por nombre). Para el auto-seed. */
export async function ensureSystemRole(
  values: {
    name: string;
    permissions: Record<string, string[]>;
    isAdmin: boolean;
  },
  database: Database = db,
): Promise<void> {
  await database
    .insert(roles)
    .values({
      name: values.name,
      permissions: values.permissions,
      isSystem: true,
      isAdmin: values.isAdmin,
    })
    .onConflictDoNothing({ target: roles.name });
}

export async function insertRole(
  values: { name: string; permissions: Record<string, string[]> },
  database: Database = db,
): Promise<Role> {
  const [row] = await database
    .insert(roles)
    .values({ name: values.name, permissions: values.permissions })
    .returning();
  if (!row) throw new Error("No se pudo crear el rol");
  return row;
}

export async function updateRoleRow(
  id: string,
  fields: { name?: string; permissions?: Record<string, string[]> },
  database: Database = db,
): Promise<Role> {
  const [row] = await database
    .update(roles)
    .set(fields)
    .where(eq(roles.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el rol");
  return row;
}

export async function deleteRoleRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(roles).where(eq(roles.id, id));
}

/** Cuántos perfiles tienen asignado este rol (para no borrar uno en uso). */
export async function countProfilesWithRole(
  roleId: string,
  database: Database = db,
): Promise<number> {
  const [r] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.roleId, roleId));
  return r?.n ?? 0;
}

/** Perfiles que pertenecen a alguno de los roles dados (p. ej. el equipo). */
export async function listProfilesByRoles(
  roles: Array<UserRow["role"]>,
  database: Database = db,
): Promise<UserRow[]> {
  if (roles.length === 0) return [];
  return database
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      role: profiles.role,
      roleId: profiles.roleId,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(inArray(profiles.role, roles))
    .orderBy(asc(profiles.role), asc(profiles.createdAt));
}

/**
 * Inserta o actualiza el perfil (rol + nombre). Se usa al invitar: el trigger de
 * Supabase puede no haber creado aún la fila, así que la garantizamos acá.
 */
export async function upsertProfile(
  input: {
    id: string;
    fullName?: string | null;
    role: UserRow["role"];
    roleId?: string | null;
    mustChangePassword?: boolean;
  },
  database: Database = db,
): Promise<void> {
  await database
    .insert(profiles)
    .values({
      id: input.id,
      fullName: input.fullName ?? null,
      role: input.role,
      roleId: input.roleId ?? null,
      mustChangePassword: input.mustChangePassword ?? false,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        role: input.role,
        ...(input.fullName != null ? { fullName: input.fullName } : {}),
        ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
        ...(input.mustChangePassword !== undefined
          ? { mustChangePassword: input.mustChangePassword }
          : {}),
      },
    });
}

/** Marca/desmarca el cambio obligatorio de contraseña en el primer ingreso. */
export async function setMustChangePassword(
  id: string,
  value: boolean,
  database: Database = db,
): Promise<void> {
  await database
    .update(profiles)
    .set({ mustChangePassword: value })
    .where(eq(profiles.id, id));
}
