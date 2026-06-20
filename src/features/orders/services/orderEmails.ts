import { sendEmail } from "@/core/email";
import { getUserEmail } from "@/core/supabase/admin";
import { siteUrl } from "@/lib/site";
import { ORDER_STATUS_LABEL } from "../constants";
import type { Order } from "../types";

// Construye el email de cambio de estado. Función pura → testeable.
export function buildOrderStatusEmail(
  order: Pick<Order, "orderNumber" | "status">,
): { subject: string; html: string } {
  const label = ORDER_STATUS_LABEL[order.status];
  const subject = `Tu pedido ${order.orderNumber}: ${label}`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#18181f">
    <div style="background:#0A0A0F;padding:24px;text-align:center;border-radius:12px 12px 0 0">
      <span style="font-family:Arial;font-weight:800;letter-spacing:.04em;color:#D4AF37;font-size:18px">HEFESTO 3D</span>
    </div>
    <div style="border:1px solid #e3e5ec;border-top:none;border-radius:0 0 12px 12px;padding:28px">
      <p style="font-size:15px">Hola 👋</p>
      <p style="font-size:15px">Tu pedido <b>${order.orderNumber}</b> cambió de estado:</p>
      <p style="font-size:20px;font-weight:700;color:#A8863A;margin:18px 0">${label}</p>
      <a href="${siteUrl}" style="display:inline-block;background:#C9A84C;color:#1a1505;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:10px">Ver mi pedido</a>
      <p style="font-size:12px;color:#9a9aa6;margin-top:24px">Hefesto 3D · Impresión 3D a pedido</p>
    </div>
  </div>`;
  return { subject, html };
}

// Notifica al cliente el estado actual del pedido (best-effort).
export async function notifyOrderStatus(
  order: Pick<Order, "orderNumber" | "status" | "customerId">,
): Promise<void> {
  const email = await getUserEmail(order.customerId);
  if (!email) return;
  const { subject, html } = buildOrderStatusEmail(order);
  await sendEmail({ to: email, subject, html });
}
