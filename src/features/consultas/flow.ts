import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors";
import { deleteObject, storeImage } from "@/core/storage";
import { notifyAdmins } from "@/features/notifications/service";
import { formatQuoteMoney } from "@/features/quotes/build-quote";
import { getQuoteDefaults } from "@/features/quotes/service";
import { buildInquiryMessage } from "./message";
import * as repo from "./repository";
import {
  MAX_INQUIRY_IMAGES,
  type InquiryAnswerInput,
  type InquiryCreateInput,
  type InquiryStatusChange,
} from "./schemas";

/**
 * Flujo de las consultas, compartido por el panel web (actions.ts) y la API
 * de la app (/api/v1/admin/consultas): lo que se hace en un lado se ve en el
 * otro porque es el mismo código contra la misma base.
 */

// Mismo bucket público que las fotos de productos, con prefijo propio.
const BUCKET = "products";
const PREFIX = "consultas";
const PAGE = "/admin/consultas";

export type Actor = { id: string; name: string | null };

function storagePath(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]!);
  return path.startsWith(`${PREFIX}/`) ? path : null;
}

const notify = (title: string, body: string) =>
  notifyAdmins({ title, body, link: PAGE }).catch(() => undefined);

const times = (n: number) => (n > 1 ? ` (x${n})` : "");

export async function createInquiry(
  input: InquiryCreateInput,
  actor: Actor,
): Promise<repo.Inquiry> {
  const row = await repo.insertInquiry({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    title: input.title,
    description: input.description,
    quantity: input.quantity,
    createdBy: actor.id,
    createdByName: actor.name,
  });
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.created",
    entityType: "inquiry",
    entityId: row.id,
    metadata: { title: row.title, customer: row.customerName },
  });
  await notify(
    "Consulta nueva",
    `${actor.name ?? "Atención al cliente"}: ${row.title}${times(row.quantity)} — ${row.customerName}`,
  );
  revalidatePath(PAGE);
  return row;
}

/** Suma una foto de referencia (quien la cargó, o quien puede responder). */
export async function addInquiryImage(
  id: string,
  bytes: Buffer,
  actor: Actor,
  canEdit: boolean,
): Promise<string> {
  const row = await repo.findInquiryById(id);
  if (!row) throw new NotFoundError("La consulta ya no existe.");
  if (row.createdBy !== actor.id && !canEdit) throw new UnauthorizedError();
  const full = `Máximo ${MAX_INQUIRY_IMAGES} fotos por consulta.`;
  if (row.images.length >= MAX_INQUIRY_IMAGES) throw new ValidationError(full);
  const { url, path } = await storeImage(
    BUCKET,
    `${PREFIX}/${id}/${randomUUID()}`,
    bytes,
  );
  if (!(await repo.appendInquiryImage(id, url, MAX_INQUIRY_IMAGES))) {
    await deleteObject(BUCKET, path).catch(() => undefined);
    throw new ValidationError(full);
  }
  revalidatePath(PAGE);
  return url;
}

/**
 * Respuesta del operador: guarda el precio y los datos, y deja armado el
 * mensaje para el cliente (el que escribió el operador, o el automático).
 */
export async function answerInquiry(
  id: string,
  input: InquiryAnswerInput,
  actor: Actor,
): Promise<repo.Inquiry> {
  const before = await repo.findInquiryById(id);
  if (!before) throw new NotFoundError("La consulta ya no existe.");
  if (before.status !== "pending" && before.status !== "answered") {
    throw new ValidationError(
      "Esta consulta ya está cerrada. Reabrila para cambiar la respuesta.",
    );
  }
  const message =
    input.message ??
    buildInquiryMessage(
      { title: before.title, quantity: before.quantity, ...input },
      await getQuoteDefaults(),
    );
  const row = await repo.saveInquiryAnswer(id, {
    unitPrice: input.unitPrice,
    bulkPrice: input.bulkPrice,
    bulkFrom: input.bulkFrom,
    dimensions: input.dimensions,
    colors: input.colors,
    deliveryTime: input.deliveryTime,
    answerNote: input.note,
    message,
    answeredBy: actor.id,
    answeredByName: actor.name,
  });
  if (!row) {
    throw new ValidationError("La consulta cambió. Actualizá la página.");
  }
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.answered",
    entityType: "inquiry",
    entityId: id,
    metadata: { title: row.title, unitPrice: input.unitPrice },
  });
  await notify(
    "Consulta respondida",
    `${row.title} — ${formatQuoteMoney(input.unitPrice)}${row.quantity > 1 ? " c/u" : ""} · ${row.customerName}`,
  );
  revalidatePath(PAGE);
  return row;
}

/** Confirmar / no se hizo / reabrir (atención al cliente). */
export async function changeInquiryStatus(
  id: string,
  to: InquiryStatusChange,
  actor: Actor,
): Promise<repo.Inquiry> {
  const before = await repo.findInquiryById(id);
  if (!before) throw new NotFoundError("La consulta ya no existe.");
  if (to === "confirmed" && before.status !== "answered") {
    throw new ValidationError(
      "Solo se puede confirmar una consulta que ya tiene respuesta.",
    );
  }
  const next = to === "reopen" ? (before.message ? "answered" : "pending") : to;
  if (next === before.status) return before;
  const row = await repo.setInquiryStatus(id, next);
  if (!row) throw new NotFoundError("La consulta ya no existe.");
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.status_changed",
    entityType: "inquiry",
    entityId: id,
    metadata: { title: row.title, from: before.status, to: next },
  });
  if (next === "confirmed") {
    await notify(
      "Consulta CONFIRMADA",
      `${row.title}${times(row.quantity)} — ${row.customerName}`,
    );
  }
  revalidatePath(PAGE);
  return row;
}

/** Borra la consulta y sus fotos (permiso, o es suya y nadie respondió). */
export async function deleteInquiry(
  id: string,
  actor: Actor,
  canDelete: boolean,
): Promise<void> {
  const row = await repo.findInquiryById(id);
  if (!row) return;
  const ownPending = row.createdBy === actor.id && row.status === "pending";
  if (!canDelete && !ownPending) throw new UnauthorizedError();
  await repo.deleteInquiryRow(id);
  for (const url of row.images) {
    const path = storagePath(url);
    if (path) await deleteObject(BUCKET, path).catch(() => undefined);
  }
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.deleted",
    entityType: "inquiry",
    entityId: id,
    metadata: { title: row.title, customer: row.customerName },
  });
  revalidatePath(PAGE);
}
