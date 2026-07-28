/**
 * Plantillas de correo del EQUIPO (invitaciones, 2026-07-24). Funciones puras:
 * arman el HTML con estilos inline (los clientes de correo no cargan CSS).
 * Estética Hefesto: tarjeta oscura, acento dorado, botón grande.
 */

const GOLD = "#C9A84C";
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function shell(inner: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f2ec;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#12121a;border-radius:16px;overflow:hidden;border:1px solid #2a2a35;">
      <tr><td style="padding:26px 32px 0;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:${GOLD};letter-spacing:.06em;">HEFESTO <span style="color:#fff;">3D</span></div>
        <div style="font-size:11px;color:#8b8b95;margin-top:2px;">Forjado en capas</div>
      </td></tr>
      ${inner}
      <tr><td style="padding:18px 32px 24px;text-align:center;">
        <div style="font-size:11px;color:#6b6b75;line-height:1.5;">Si no esperabas este correo, podés ignorarlo sin problema.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/** Invitación a unirse al equipo: mensaje del admin + botón con el link de un
 * solo uso que lleva a crear la contraseña. */
export function buildTeamInviteEmail(params: {
  roleName: string | null;
  message: string | null;
  acceptUrl: string;
}): { subject: string; html: string } {
  const role = params.roleName ? esc(params.roleName) : null;
  const msg = params.message?.trim()
    ? `<div style="background:#1b1b26;border:1px solid #2a2a35;border-radius:10px;padding:14px 16px;margin:0 0 18px;color:#d9d9e0;font-size:13.5px;line-height:1.6;white-space:pre-line;">${esc(params.message.trim())}</div>`
    : "";
  const html = shell(`
      <tr><td style="padding:22px 32px 0;">
        <h1 style="margin:0 0 10px;font-size:19px;color:#ffffff;">Te invitaron al equipo</h1>
        <p style="margin:0 0 16px;color:#a8a8b2;font-size:13.5px;line-height:1.6;">
          Te sumaron al equipo de gestión de <b style="color:#fff;">Hefesto 3D</b>${role ? ` con el rol de <b style="color:${GOLD};">${role}</b>` : ""}.
        </p>
        ${msg}
        <div style="text-align:center;margin:6px 0 10px;">
          <a href="${params.acceptUrl}" style="display:inline-block;background:${GOLD};color:#12121a;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 30px;border-radius:10px;">Unirme y crear mi contraseña</a>
        </div>
        <p style="margin:12px 0 0;color:#8b8b95;font-size:12px;line-height:1.6;text-align:center;">
          El link es <b>de un solo uso</b> y vence pronto por seguridad.<br/>Tu contraseña la elegís vos: nadie más la va a conocer.
        </p>
      </td></tr>`);
  return { subject: "Te invitaron al equipo de Hefesto 3D", html };
}

/** El email ya era CLIENTE de la tienda: se lo promueve al equipo con su misma
 * cuenta y contraseña (no hay que crear nada). */
export function buildTeamPromotedEmail(params: {
  roleName: string;
  message: string | null;
  panelUrl: string;
}): { subject: string; html: string } {
  const msg = params.message?.trim()
    ? `<div style="background:#1b1b26;border:1px solid #2a2a35;border-radius:10px;padding:14px 16px;margin:0 0 18px;color:#d9d9e0;font-size:13.5px;line-height:1.6;white-space:pre-line;">${esc(params.message.trim())}</div>`
    : "";
  const html = shell(`
      <tr><td style="padding:22px 32px 0;">
        <h1 style="margin:0 0 10px;font-size:19px;color:#ffffff;">Ahora sos parte del equipo</h1>
        <p style="margin:0 0 16px;color:#a8a8b2;font-size:13.5px;line-height:1.6;">
          Tu cuenta de <b style="color:#fff;">Hefesto 3D</b> ahora tiene acceso al panel de gestión con el rol de <b style="color:${GOLD};">${esc(params.roleName)}</b>. Entrá con tu email y tu contraseña de siempre.
        </p>
        ${msg}
        <div style="text-align:center;margin:6px 0 10px;">
          <a href="${params.panelUrl}" style="display:inline-block;background:${GOLD};color:#12121a;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 30px;border-radius:10px;">Ir al panel</a>
        </div>
      </td></tr>`);
  return { subject: "Ahora sos parte del equipo de Hefesto 3D", html };
}
