import * as repo from "./repository";
import type { Notification } from "./repository";

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
    customerId: params.customerId,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
}
