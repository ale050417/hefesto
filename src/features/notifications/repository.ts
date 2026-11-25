import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/core/db";
import {
  notificationPrefs,
  notifications,
  profiles,
  pushSubscriptions,
  roles,
} from "@/core/db/schema";

type Database = typeof db;
export type Notification = typeof notifications.$inferSelect;

// --- Cliente (audience 'customer') ---

export async function listByCustomer(
  customerId: string,
  limit = 20,
  database: Database = db,
): Promise<Notification[]> {
  return database
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.audience, "customer"),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function countUnread(
  customerId: string,
  database: Database = db,
): Promise<number> {
  const rows = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.audience, "customer"),
        eq(notifications.isRead, false),
      ),
    );
  return rows.length;
}

export async function markAllRead(
  customerId: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.customerId, customerId),
        eq(notifications.audience, "customer"),
      ),
    );
}

// --- Admin (audience 'admin', broadcast al staff) ---

/** Tipo del aviso; los viejos sin tipo cuentan como "other". */
const kindExpr = sql<string>`coalesce(${notifications.kind}, 'other')`;

/**
 * Avisos del panel para UNA persona: solo los tipos que le llegan (`kinds`) y
 * sin los que generó ella misma.
 */
function adminScope(kinds: readonly string[], userId: string) {
  return and(
    eq(notifications.audience, "admin"),
    inArray(kindExpr, [...kinds]),
    or(isNull(notifications.actorId), ne(notifications.actorId, userId)),
  );
}

export async function listForAdmin(
  kinds: readonly string[],
  userId: string,
  limit = 30,
  database: Database = db,
): Promise<Notification[]> {
  if (kinds.length === 0) return [];
  return database
    .select()
    .from(notifications)
    .where(adminScope(kinds, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/**
 * No leídos de esta persona: los posteriores a su última lectura. Si nunca
 * abrió la campana (`seenAt` null), vale la marca vieja compartida `is_read`.
 */
export async function countUnreadAdmin(
  kinds: readonly string[],
  userId: string,
  seenAt: Date | null,
  database: Database = db,
): Promise<number> {
  if (kinds.length === 0) return 0;
  const [row] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        adminScope(kinds, userId),
        seenAt
          ? sql`${notifications.createdAt} > ${seenAt.toISOString()}::timestamptz`
          : eq(notifications.isRead, false),
      ),
    );
  return row?.n ?? 0;
}

export async function insertNotification(
  values: typeof notifications.$inferInsert,
  database: Database = db,
): Promise<void> {
  await database.insert(notifications).values(values);
}

// --- Preferencias por persona (0085) ---

export type NotificationPrefs = { mutedKinds: string[]; seenAt: Date | null };

export async function getPrefs(
  profileId: string,
  database: Database = db,
): Promise<NotificationPrefs> {
  const [row] = await database
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.profileId, profileId));
  return { mutedKinds: row?.mutedKinds ?? [], seenAt: row?.seenAt ?? null };
}

export async function markSeen(
  profileId: string,
  database: Database = db,
): Promise<void> {
  const now = new Date();
  await database
    .insert(notificationPrefs)
    .values({ profileId, seenAt: now })
    .onConflictDoUpdate({
      target: notificationPrefs.profileId,
      set: { seenAt: now },
    });
}

export async function setMutedKinds(
  profileId: string,
  mutedKinds: string[],
  database: Database = db,
): Promise<void> {
  await database
    .insert(notificationPrefs)
    .values({ profileId, mutedKinds })
    .onConflictDoUpdate({
      target: notificationPrefs.profileId,
      set: { mutedKinds },
    });
}

// --- Dispositivos con avisos push (0085) ---

export async function upsertPushSubscription(
  values: {
    profileId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent: string | null;
  },
  database: Database = db,
): Promise<void> {
  // El mismo navegador puede cambiar de cuenta: el dispositivo queda a nombre
  // de quien lo activó último.
  await database
    .insert(pushSubscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        profileId: values.profileId,
        p256dh: values.p256dh,
        auth: values.auth,
        userAgent: values.userAgent,
      },
    });
}

export async function deletePushSubscription(
  endpoint: string,
  profileId?: string,
  database: Database = db,
): Promise<void> {
  await database
    .delete(pushSubscriptions)
    .where(
      profileId
        ? and(
            eq(pushSubscriptions.endpoint, endpoint),
            eq(pushSubscriptions.profileId, profileId),
          )
        : eq(pushSubscriptions.endpoint, endpoint),
    );
}

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
  profileId: string;
  enumRole: "customer" | "operator" | "admin";
  roleIsAdmin: boolean | null;
  rolePermissions: Record<string, string[]> | null;
  mutedKinds: string[] | null;
};

/** Dispositivos del equipo, con lo necesario para decidir a quién le llega. */
export async function listStaffPushTargets(
  database: Database = db,
): Promise<PushTarget[]> {
  return database
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      profileId: pushSubscriptions.profileId,
      enumRole: profiles.role,
      roleIsAdmin: roles.isAdmin,
      rolePermissions: roles.permissions,
      mutedKinds: notificationPrefs.mutedKinds,
    })
    .from(pushSubscriptions)
    .innerJoin(profiles, eq(profiles.id, pushSubscriptions.profileId))
    .leftJoin(roles, eq(roles.id, profiles.roleId))
    .leftJoin(
      notificationPrefs,
      eq(notificationPrefs.profileId, pushSubscriptions.profileId),
    )
    .where(inArray(profiles.role, ["admin", "operator"]));
}
