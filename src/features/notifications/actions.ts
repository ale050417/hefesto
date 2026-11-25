"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/core/auth/session";
import { getResolveInputForUser } from "@/core/auth/permissions";
import type { KindPref } from "./kinds";
import {
  getAdminNotifications,
  getNotifications,
  markAdminSeen,
  markAllRead,
  removePushSubscription,
  savePushSubscription,
  setMutedKinds,
  type AdminNotifications,
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

// --- Admin (avisos del panel; requiere ser staff) ---

const EMPTY: AdminNotifications = { items: [], unread: 0, kinds: [] };

/** El usuario del panel con sus permisos, o null si no es del equipo. */
async function staff() {
  const user = await getCurrentUser();
  const role = user?.profile?.role;
  if (!user || (role !== "admin" && role !== "operator")) return null;
  return { user, perms: await getResolveInputForUser(user) };
}

export async function getAdminNotificationsAction(): Promise<AdminNotifications> {
  try {
    const me = await staff();
    if (!me) return EMPTY;
    return await getAdminNotifications(me.user.id, me.perms);
  } catch (e) {
    console.error("[notif] no se pudieron leer las notificaciones admin:", e);
    return EMPTY;
  }
}

export async function markAdminNotificationsReadAction(): Promise<{
  ok: boolean;
}> {
  const me = await staff();
  if (!me) return { ok: false };
  await markAdminSeen(me.user.id);
  return { ok: true };
}

/** Guarda qué tipos de aviso apagó esta persona. */
export async function saveNotificationPrefsAction(
  muted: unknown,
): Promise<{ ok: true; kinds: KindPref[] } | { ok: false }> {
  const parsed = z.array(z.string().max(40)).max(40).safeParse(muted);
  if (!parsed.success) return { ok: false };
  try {
    const me = await staff();
    if (!me) return { ok: false };
    return {
      ok: true,
      kinds: await setMutedKinds(me.user.id, me.perms, parsed.data),
    };
  } catch (e) {
    console.error("[notif] no se pudieron guardar las preferencias:", e);
    return { ok: false };
  }
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  p256dh: z.string().min(10).max(300),
  auth: z.string().min(4).max(300),
});

/** Este navegador aceptó recibir avisos: se guarda su suscripción. */
export async function savePushSubscriptionAction(
  input: unknown,
): Promise<{ ok: boolean }> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success || !parsed.data.endpoint.startsWith("https://")) {
    return { ok: false };
  }
  try {
    const me = await staff();
    if (!me) return { ok: false };
    const userAgent = (await headers()).get("user-agent");
    await savePushSubscription(me.user.id, parsed.data, userAgent);
    return { ok: true };
  } catch (e) {
    console.error("[notif] no se pudo guardar el dispositivo:", e);
    return { ok: false };
  }
}

export async function deletePushSubscriptionAction(
  endpoint: unknown,
): Promise<{ ok: boolean }> {
  const parsed = z.string().max(2000).safeParse(endpoint);
  if (!parsed.success) return { ok: false };
  try {
    const me = await staff();
    if (!me) return { ok: false };
    await removePushSubscription(me.user.id, parsed.data);
    return { ok: true };
  } catch (e) {
    console.error("[notif] no se pudo quitar el dispositivo:", e);
    return { ok: false };
  }
}
