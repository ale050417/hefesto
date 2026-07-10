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

// --- Admin (broadcast al staff) ---

export async function getAdminNotifications(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const [items, unread] = await Promise.all([
    repo.listForAdmin(),
    repo.countUnreadAdmin(),
  ]);
  return { items, unread };
}

export async function markAllReadAdmin() {
  return repo.markAllReadAdmin();
}

/**
 * Crea un aviso para el ADMIN (pedido nuevo, stock bajo, mensaje de cliente).
 * Broadcast: sin customerId. Best-effort — lo llaman otros services y NUNCA
 * debe romper la operación que lo dispara (por eso los callers lo envuelven en
 * try/catch o .catch()).
 */
export async function notifyAdmins(params: {
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  await repo.insertNotification({
    audience: "admin",
    customerId: null,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
}
