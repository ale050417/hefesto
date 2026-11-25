import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
} from "./actions";

/**
 * Avisos push en ESTE navegador (lado cliente). El service worker es
 * `/sw.js`: solo muestra avisos, no cachea nada.
 *
 * - "unsupported": el navegador no puede (ej. iPhone sin instalar la web en
 *   la pantalla de inicio).
 * - "unconfigured": al servidor le faltan las claves para mandar avisos.
 * - "denied": la persona (o el navegador) bloqueó los avisos de este sitio.
 * - "off" / "on": se puede activar / está activado.
 */
export type PushState =
  | "unsupported"
  | "unconfigured"
  | "denied"
  | "off"
  | "on";

const SW_URL = "/sw.js";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** La clave pública viene en base64 "url-safe"; el navegador pide bytes. */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

function toPayload(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}

export async function getPushState(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (!PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  try {
    const sub = await currentSubscription();
    if (sub && Notification.permission === "granted") {
      // Se vuelve a guardar por si cambió de cuenta en este navegador.
      void savePushSubscriptionAction(toPayload(sub));
      return "on";
    }
  } catch {
    // sin service worker todavía: está apagado
  }
  return "off";
}

/** Pide permiso, registra el service worker y guarda el dispositivo. */
export async function enablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  if (!PUBLIC_KEY) return "unconfigured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "off";
  }
  const reg = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(PUBLIC_KEY),
    }));
  const saved = await savePushSubscriptionAction(toPayload(sub));
  if (!saved.ok) {
    await sub.unsubscribe().catch(() => undefined);
    throw new Error("No se pudo guardar el dispositivo.");
  }
  return "on";
}

export async function disablePush(): Promise<PushState> {
  if (!supported()) return "unsupported";
  const sub = await currentSubscription().catch(() => null);
  if (sub) {
    await deletePushSubscriptionAction(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return "off";
}
