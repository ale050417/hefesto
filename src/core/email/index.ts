import { env } from "@/core/config/env";

export type SendEmailParams = { to: string; subject: string; html: string };

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

// Cliente lazy: el SDK se carga solo si hay API key (no rompe el build/tests).
let client: import("resend").Resend | null = null;
async function getClient() {
  if (!client) {
    const { Resend } = await import("resend");
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}

/**
 * Envía un email transaccional. Si Resend no está configurado, lo omite con un
 * aviso (en desarrollo). Adapter sobre el SDK (el resto de la app no lo importa).
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.warn(`[email] omitido (sin RESEND_API_KEY): ${params.subject}`);
    return;
  }
  const from = env.RESEND_FROM ?? "Hefesto 3D <onboarding@resend.dev>";
  const resend = await getClient();
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
