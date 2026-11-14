import { eq, sql } from "drizzle-orm";
import { db } from "@/core/db";
import { orders, profiles } from "@/core/db/schema";
import { getSupabaseAdmin } from "@/core/supabase/admin";

/**
 * Baja de la cuenta por su propio dueño (2026-11-14, pedido de Ale: publicar la
 * app en App Store y Play Store). Las dos tiendas exigen que, si la app deja
 * crear una cuenta, también deje ELIMINARLA desde la app.
 *
 * Qué se borra:
 *  - Cliente SIN compras → se borra el usuario de Supabase Auth; la base borra
 *    en cascada su perfil, direcciones, favoritos, puntos, pedidos a medida y
 *    notificaciones.
 *  - Cliente CON compras → los pedidos no se pueden borrar (son el respaldo de
 *    cada comprobante: obligación fiscal, y `orders.customer_id` es RESTRICT).
 *    Se pasan a un perfil de sistema ("Cuenta eliminada") y recién ahí se borra
 *    el usuario, con todo lo demás en cascada. El pedido conserva solo la copia
 *    de los datos de entrega con la que se emitió.
 *
 * Las cuentas del equipo (admin / operador) NO se dan de baja por acá: las
 * maneja un administrador desde Configuración → Equipo (así nadie se queda sin
 * el único administrador por un toque).
 */

export type DeleteAccountResult =
  | { ok: true; mode: "deleted" | "orders_kept" }
  | { ok: false; reason: "staff" | "failed" };

export type DeleteAccountUser = { id: string; role: string | null };

/** Dependencias de la baja (se inyectan dobles en los tests). */
export type DeleteAccountDeps = {
  countOrders(userId: string): Promise<number>;
  /** Perfil de sistema que conserva los pedidos; lo crea si todavía no existe. */
  ensureTombstone(): Promise<string>;
  moveOrders(fromUserId: string, toUserId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<{ error: string | null }>;
};

export async function deleteOwnAccount(
  user: DeleteAccountUser,
  deps: DeleteAccountDeps = realDeps,
): Promise<DeleteAccountResult> {
  if (user.role === "admin" || user.role === "operator") {
    return { ok: false, reason: "staff" };
  }

  const orderCount = await deps.countOrders(user.id);
  if (orderCount > 0) {
    const tombstoneId = await deps.ensureTombstone();
    // Nunca mover los pedidos "a uno mismo": el borrado de abajo fallaría por
    // la restricción y la cuenta quedaría a medio borrar.
    if (tombstoneId === user.id) return { ok: false, reason: "failed" };
    await deps.moveOrders(user.id, tombstoneId);
  }

  const { error } = await deps.deleteAuthUser(user.id);
  if (error) {
    console.error("[delete-account] no se pudo borrar el usuario:", error);
    return { ok: false, reason: "failed" };
  }
  return { ok: true, mode: orderCount > 0 ? "orders_kept" : "deleted" };
}

// --- Implementación real ---------------------------------------------------

/** Marca del perfil de sistema (se busca por esta nota, no por un id fijo). */
export const TOMBSTONE_NOTE =
  "[sistema] Pedidos de clientes que eliminaron su cuenta. No borrar.";
export const TOMBSTONE_NAME = "Cuenta eliminada";
const TOMBSTONE_EMAIL = "cuentas-eliminadas@hefesto3d.com.ar";
/** ~100 años: la cuenta de sistema no puede iniciar sesión. */
const BAN_FOREVER = "876000h";

async function findTombstoneId(): Promise<string | null> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.adminNote, TOMBSTONE_NOTE))
    .limit(1);
  return row?.id ?? null;
}

async function ensureTombstone(): Promise<string> {
  const existing = await findTombstoneId();
  if (existing) return existing;

  const admin = getSupabaseAdmin();
  let id: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: TOMBSTONE_EMAIL,
    email_confirm: true,
    ban_duration: BAN_FOREVER,
    user_metadata: { full_name: TOMBSTONE_NAME },
  });
  if (created.data?.user) {
    id = created.data.user.id;
  } else {
    // Ya existía el usuario (dos bajas a la vez, o un intento anterior que no
    // llegó a marcar el perfil): se lo busca por su email.
    for (let page = 1; page <= 20 && !id; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error || !data) break;
      id = data.users.find((u) => u.email === TOMBSTONE_EMAIL)?.id ?? null;
      if (data.users.length < 1000) break;
    }
  }
  if (!id) {
    throw new Error(
      `No se pudo crear el perfil de cuentas eliminadas: ${created.error?.message ?? "sin detalle"}`,
    );
  }

  // El trigger de auth.users ya creó el perfil; acá se lo marca (y si por algo
  // no existiera, se crea).
  await db
    .insert(profiles)
    .values({ id, fullName: TOMBSTONE_NAME, adminNote: TOMBSTONE_NOTE })
    .onConflictDoUpdate({
      target: profiles.id,
      set: { fullName: TOMBSTONE_NAME, adminNote: TOMBSTONE_NOTE },
    });
  return id;
}

const realDeps: DeleteAccountDeps = {
  async countOrders(userId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.customerId, userId));
    return row?.n ?? 0;
  },
  ensureTombstone,
  async moveOrders(fromUserId, toUserId) {
    await db
      .update(orders)
      .set({ customerId: toUserId })
      .where(eq(orders.customerId, fromUserId));
  },
  async deleteAuthUser(userId) {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
    return { error: error?.message ?? null };
  },
};
