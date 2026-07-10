"use server";

import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import {
  getAdminNotifications,
  getNotifications,
  markAllRead,
  markAllReadAdmin,
} from "./service";
import type { Notification } from "./repository";

export async function getMyNotificationsAction(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };
  try {
    return await getNotifications(user.id);
  } catch (e) {
    // Si la tabla aún no está migrada en la base, no rompemos el header.
    console.error("[notif] no se pudieron leer las notificaciones:", e);
    return { items: [], unread: 0 };
  }
}

export async function markNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await markAllRead(user.id);
  return { ok: true };
}

// --- Admin (broadcast al staff; requiere ser staff) ---

export async function getAdminNotificationsAction(): Promise<{
  items: Notification[];
  unread: number;
}> {
  // Cualquier staff con acceso al panel puede ver los avisos del negocio.
  if (!(await can("pedidos", "ver"))) return { items: [], unread: 0 };
  try {
    return await getAdminNotifications();
  } catch (e) {
    console.error("[notif] no se pudieron leer las notificaciones admin:", e);
    return { items: [], unread: 0 };
  }
}

export async function markAdminNotificationsReadAction(): Promise<{
  ok: boolean;
}> {
  if (!(await can("pedidos", "ver"))) return { ok: false };
  await markAllReadAdmin();
  return { ok: true };
}
