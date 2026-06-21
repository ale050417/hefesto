"use server";

import { getCurrentUser } from "@/core/auth/session";
import { getNotifications, markAllRead } from "./service";
import type { Notification } from "./repository";

export async function getMyNotificationsAction(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };
  return getNotifications(user.id);
}

export async function markNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await markAllRead(user.id);
  return { ok: true };
}
