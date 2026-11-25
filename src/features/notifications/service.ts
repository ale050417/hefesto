import type { ResolveInput } from "@/core/auth/perm-defs";
import {
  activeKinds,
  isAdminNotificationKind,
  kindOf,
  kindPrefs,
  visibleKinds,
  type AdminNotificationKind,
  type KindPref,
} from "./kinds";
import { sendAdminPush } from "./push";
import * as repo from "./repository";
import type { Notification } from "./repository";

// --- Cliente ---

export async function getNotifications(
  customerId: string,
): Promise<{ items: Notification[]; unread: number }> {
  const [items, unread] = await Promise.all([
    repo.listByCustomer(customerId),
    repo.countUnread(customerId),
  ]);
  return { items, unread };
}

export async function markAllRead(customerId: string) {
  return repo.markAllRead(customerId);
}

// Crea un aviso para el cliente (best-effort; lo llaman otros servicios).
export async function notifyCustomer(params: {
  customerId: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  await repo.insertNotification({
    audience: "customer",
    customerId: params.customerId,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
}

// --- Admin (avisos del panel) ---

/** Un aviso como lo ven la campana de la web y la app. */
export type AdminNotificationView = {
  id: string;
  kind: AdminNotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  unread: boolean;
  createdAt: string;
};

export type AdminNotifications = {
  items: AdminNotificationView[];
  unread: number;
  /** Tipos que esta persona puede ver, con su interruptor. */
  kinds: KindPref[];
};

/**
 * Avisos del panel para UNA persona (0085): solo los tipos que puede ver por
 * sus permisos y no apagó, sin los que generó ella misma, y con SU "no leído"
 * (antes era uno solo para todo el equipo).
 */
export async function getAdminNotifications(
  userId: string,
  perms: ResolveInput,
): Promise<AdminNotifications> {
  const prefs = await repo.getPrefs(userId);
  const kinds = activeKinds(perms, prefs.mutedKinds);
  const [rows, unread] = await Promise.all([
    repo.listForAdmin(kinds, userId),
    repo.countUnreadAdmin(kinds, userId, prefs.seenAt),
  ]);
  const seen = prefs.seenAt?.getTime() ?? null;
  return {
    items: rows.map((n) => ({
      id: n.id,
      kind: kindOf(n.kind),
      title: n.title,
      body: n.body,
      link: n.link,
      unread: seen == null ? !n.isRead : n.createdAt.getTime() > seen,
      createdAt: n.createdAt.toISOString(),
    })),
    unread,
    kinds: kindPrefs(perms, prefs.mutedKinds),
  };
}

/** Marca todo como leído PARA ESTA persona. */
export async function markAdminSeen(userId: string): Promise<void> {
  await repo.markSeen(userId);
}

/**
 * Guarda qué tipos apagó. Solo cuentan los tipos que existen y que la persona
 * puede ver (no se puede "apagar" algo que igual no le llega).
 */
export async function setMutedKinds(
  userId: string,
  perms: ResolveInput,
  muted: readonly string[],
): Promise<KindPref[]> {
  const visible = new Set<string>(visibleKinds(perms));
  const clean = [
    ...new Set(
      muted.filter((k) => isAdminNotificationKind(k) && visible.has(k)),
    ),
  ];
  await repo.setMutedKinds(userId, clean);
  return kindPrefs(perms, clean);
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
  userAgent: string | null,
): Promise<void> {
  await repo.upsertPushSubscription({
    profileId: userId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
}

export async function removePushSubscription(
  userId: string,
  endpoint: string,
): Promise<void> {
  await repo.deletePushSubscription(endpoint, userId);
}

/**
 * Crea un aviso para el panel (pedido nuevo, stock bajo, consulta nueva…) y lo
 * manda como push a los dispositivos que lo tienen activado. `kind` decide a
 * quién le llega (permisos + lo que cada uno apagó); `actorId` es quien lo
 * generó, que no recibe su propio aviso. Best-effort: lo llaman otros services
 * y NUNCA debe romper la operación que lo dispara (por eso los callers lo
 * envuelven en try/catch o .catch()).
 */
export async function notifyAdmins(params: {
  kind?: AdminNotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}): Promise<void> {
  const kind = params.kind ?? "other";
  await repo.insertNotification({
    audience: "admin",
    customerId: null,
    kind,
    actorId: params.actorId ?? null,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
  await sendAdminPush({ ...params, kind }).catch((error) =>
    console.error("[push] falló el envío:", error),
  );
}
