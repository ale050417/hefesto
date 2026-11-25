import webpush from "web-push";
import { activeKinds, type AdminNotificationKind } from "./kinds";
import * as repo from "./repository";

/**
 * Avisos push del panel (Web Push, sugerencia de Agustín 2026-11-22: que el
 * aviso llegue al celular / la compu aunque no esté mirando la campana).
 *
 * Cada persona activa los avisos en SU navegador (campana → "Activar avisos
 * en este dispositivo"); eso guarda una suscripción en `push_subscriptions`.
 * Cuando se crea un aviso del panel, se manda a los dispositivos de quienes
 * pueden ver ese tipo, no lo apagaron y no son quien lo generó.
 *
 * Necesita NEXT_PUBLIC_VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY. Sin esas claves
 * no se manda nada y la campana sigue funcionando como siempre.
 */

/** Tope: mandar avisos nunca demora la operación que los dispara. */
const SEND_TIMEOUT_MS = 4_000;

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  try {
    webpush.setVapidDetails(
      // Contacto que exige el estándar: una URL https (o un mailto:).
      process.env.VAPID_SUBJECT || "https://hefesto3d.com.ar",
      publicKey,
      privateKey,
    );
    configured = true;
  } catch (error) {
    console.error("[push] claves VAPID inválidas:", error);
    configured = false;
  }
  return configured;
}

export function pushConfigured(): boolean {
  return configure();
}

/** Pura y testeada: a qué dispositivos le llega un aviso de este tipo. */
export function pickPushTargets(
  targets: repo.PushTarget[],
  kind: AdminNotificationKind,
  actorId: string | null,
): repo.PushTarget[] {
  return targets.filter((t) => {
    if (actorId && t.profileId === actorId) return false;
    const allowed = activeKinds(
      {
        enumRole: t.enumRole,
        role:
          t.roleIsAdmin == null
            ? null
            : {
                isAdmin: t.roleIsAdmin,
                permissions: t.rolePermissions ?? {},
              },
      },
      t.mutedKinds ?? [],
    );
    return allowed.includes(kind);
  });
}

export async function sendAdminPush(params: {
  kind: AdminNotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}): Promise<void> {
  if (!configure()) return;
  const targets = pickPushTargets(
    await repo.listStaffPushTargets(),
    params.kind,
    params.actorId ?? null,
  );
  if (targets.length === 0) return;

  const payload = JSON.stringify({
    title: params.title,
    body: params.body ?? "",
    url: params.link ?? "/admin",
    // Mismo tipo y destino = se reemplaza en vez de apilar 10 iguales.
    tag: `${params.kind}:${params.link ?? ""}`,
  });

  const sendAll = Promise.allSettled(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          payload,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
      } catch (error) {
        const status = (error as { statusCode?: number } | null)?.statusCode;
        // 404/410: el navegador dio de baja esa suscripción. Se borra.
        if (status === 404 || status === 410) {
          await repo.deletePushSubscription(t.endpoint).catch(() => undefined);
        } else {
          console.error("[push] no se pudo enviar:", status ?? error);
        }
      }
    }),
  );
  await Promise.race([
    sendAll,
    new Promise((resolve) => setTimeout(resolve, SEND_TIMEOUT_MS)),
  ]);
}
