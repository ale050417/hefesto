import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { recordAudit } from "@/core/audit";
import { env } from "@/core/config/env";
import { sendEmail } from "@/core/email";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors";
import { deleteObject, storeImage } from "@/core/storage";
import { getSupabaseAdmin } from "@/core/supabase/admin";
import { notifyAdmins } from "@/features/notifications/service";
import * as repo from "./repository";
import {
  FIX_STATUS_LABEL,
  MAX_FIX_IMAGES,
  type FixCreateInput,
  type FixUpdateInput,
} from "./schemas";

// Mismo bucket público que las fotos de productos, con prefijo propio (igual
// que custom/ y categories/). El nombre del archivo es un UUID: la URL no se
// puede adivinar, pero quien la tenga la puede abrir.
const BUCKET = "products";
const PREFIX = "arreglos";
const PAGE = "/admin/arreglos";

type Actor = { id: string; name: string | null };

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Ruta dentro del bucket a partir de la URL pública (para borrar la foto). */
function storagePath(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]!);
  return path.startsWith(`${PREFIX}/`) ? path : null;
}

/**
 * Correo a las cuentas dueñas. La campanita del panel solo se ve con el panel
 * abierto; el correo es lo que le llega a Ale aunque no esté mirando. Sin
 * RESEND_API_KEY `sendEmail` no hace nada.
 */
async function emailOwners(fix: repo.FixRequest, actor: Actor): Promise<void> {
  const ids = (await repo.listOwnerIds()).filter((id) => id !== actor.id);
  if (ids.length === 0) return;
  const supabase = getSupabaseAdmin();
  const link = `${env.NEXT_PUBLIC_SITE_URL}${PAGE}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <p style="color:#666;margin:0 0 4px">Arreglo nuevo${fix.urgent ? ' · <b style="color:#c0392b">URGENTE</b>' : ""}</p>
      <h2 style="margin:0 0 12px">${esc(fix.title)}</h2>
      <p style="white-space:pre-wrap;margin:0 0 16px">${esc(fix.description)}</p>
      <p style="color:#666;margin:0 0 16px">Lo cargó ${esc(actor.name ?? "el operador")}. Las fotos, si subió, están en el panel.</p>
      <p><a href="${link}">Ver en el panel</a></p>
    </div>`;
  for (const id of ids) {
    const { data } = await supabase.auth.admin.getUserById(id);
    const to = data.user?.email;
    if (!to) continue;
    await sendEmail({
      to,
      subject: `${fix.urgent ? "[URGENTE] " : ""}Arreglo nuevo: ${fix.title}`,
      html,
    });
  }
}

export async function createFix(
  input: FixCreateInput,
  actor: Actor,
): Promise<repo.FixRequest> {
  const fix = await repo.insertFix({
    title: input.title,
    description: input.description,
    urgent: input.urgent,
    createdBy: actor.id,
    createdByName: actor.name,
  });
  await recordAudit({
    actorId: actor.id,
    action: "fix.created",
    entityType: "fix_request",
    entityId: fix.id,
    metadata: { title: fix.title, urgent: fix.urgent },
  });
  // Avisos best-effort: nunca rompen el alta.
  await notifyAdmins({
    kind: "fix",
    actorId: actor.id,
    title: fix.urgent ? "Arreglo URGENTE" : "Arreglo nuevo",
    body: `${actor.name ?? "El operador"}: ${fix.title}`,
    link: PAGE,
  }).catch(() => undefined);
  try {
    after(async () => {
      try {
        await emailOwners(fix, actor);
      } catch (mailError) {
        console.error("[arreglos] no se pudo avisar por correo:", mailError);
      }
    });
  } catch {
    /* fuera de un request (tests): sin correo */
  }
  revalidatePath(PAGE);
  return fix;
}

/**
 * Sube una foto al arreglo. Solo quien lo cargó (o quien puede editar
 * arreglos) puede sumarle fotos.
 */
export async function addFixImage(
  fixId: string,
  bytes: Buffer,
  actor: Actor,
  canEdit: boolean,
): Promise<string> {
  const fix = await repo.findFixById(fixId);
  if (!fix) throw new NotFoundError("El arreglo ya no existe.");
  if (fix.createdBy !== actor.id && !canEdit) throw new UnauthorizedError();
  if (fix.images.length >= MAX_FIX_IMAGES) {
    throw new ValidationError(`Máximo ${MAX_FIX_IMAGES} fotos por arreglo.`);
  }
  const { url, path } = await storeImage(
    BUCKET,
    `${PREFIX}/${fixId}/${randomUUID()}`,
    bytes,
  );
  const added = await repo.appendFixImage(fixId, url, MAX_FIX_IMAGES);
  if (!added) {
    await deleteObject(BUCKET, path).catch(() => undefined);
    throw new ValidationError(`Máximo ${MAX_FIX_IMAGES} fotos por arreglo.`);
  }
  revalidatePath(PAGE);
  return url;
}

export async function updateFix(
  id: string,
  input: FixUpdateInput,
  actor: Actor,
): Promise<void> {
  const before = await repo.findFixById(id);
  if (!before) throw new NotFoundError("El arreglo ya no existe.");
  const fix = await repo.updateFixStatus(id, input);
  if (!fix) throw new NotFoundError("El arreglo ya no existe.");
  await recordAudit({
    actorId: actor.id,
    action: "fix.updated",
    entityType: "fix_request",
    entityId: id,
    metadata: { title: fix.title, from: before.status, to: fix.status },
  });
  // Que el que lo cargó se entere de la respuesta (campanita del panel).
  if (before.status !== fix.status || before.ownerNote !== fix.ownerNote) {
    await notifyAdmins({
      kind: "fix",
      title: `Arreglo ${FIX_STATUS_LABEL[input.status].toLowerCase()}`,
      body: fix.ownerNote ? `${fix.title} — ${fix.ownerNote}` : fix.title,
      link: PAGE,
    }).catch(() => undefined);
  }
  revalidatePath(PAGE);
}

/**
 * Borra el arreglo y sus fotos. Lo puede borrar quien tiene el permiso, o
 * quien lo cargó mientras siga pendiente (se equivocó al cargarlo).
 */
export async function deleteFix(
  id: string,
  actor: Actor,
  canDelete: boolean,
): Promise<void> {
  const fix = await repo.findFixById(id);
  if (!fix) return;
  const ownPending = fix.createdBy === actor.id && fix.status === "pending";
  if (!canDelete && !ownPending) throw new UnauthorizedError();
  await repo.deleteFixRow(id);
  for (const url of fix.images) {
    const path = storagePath(url);
    if (path) await deleteObject(BUCKET, path).catch(() => undefined);
  }
  await recordAudit({
    actorId: actor.id,
    action: "fix.deleted",
    entityType: "fix_request",
    entityId: id,
    metadata: { title: fix.title },
  });
  revalidatePath(PAGE);
}
