import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/core/errors";
import { deleteObject, storeImage, uploadObject } from "@/core/storage";
import { notifyAdmins } from "@/features/notifications/service";
import { registerManualSale } from "@/features/orders/manual-sale-flow";
import { formatQuoteMoney } from "@/features/quotes/build-quote";
import { getQuoteDefaults } from "@/features/quotes/service";
import { buildInquiryMessage } from "./message";
import * as repo from "./repository";
import {
  MAX_INQUIRY_FILES,
  MAX_INQUIRY_FILE_BYTES,
  MAX_INQUIRY_IMAGES,
  isAllowedInquiryFile,
  type InquiryAnswerInput,
  type InquiryCreateInput,
  type InquiryPaymentMethod,
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

const notify = (
  kind: "inquiry" | "inquiry_answered" | "inquiry_confirmed",
  title: string,
  body: string,
  actor: Actor,
) =>
  notifyAdmins({ kind, title, body, link: PAGE, actorId: actor.id }).catch(
    () => undefined,
  );

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
    "inquiry",
    "Consulta nueva",
    `${actor.name ?? "Atención al cliente"}: ${row.title}${times(row.quantity)} — ${row.customerName}`,
    actor,
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
    unitCost: input.unitCost,
    estFilamentId: input.filamentId,
    estMaterial: input.material,
    estGrams: input.grams,
    estMinutes: input.printMinutes,
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
    "inquiry_answered",
    "Consulta respondida",
    `${row.title} — ${formatQuoteMoney(input.unitPrice)}${row.quantity > 1 ? " c/u" : ""} · ${row.customerName}`,
    actor,
  );
  revalidatePath(PAGE);
  return row;
}

/** Hoy en Argentina, como lo manda el formulario de ventas (AAAA-MM-DD). */
function todayAr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

/**
 * Confirmar: la consulta pasa a confirmada Y se crea sola la venta en estado
 * "confirmado" (pedido de Ale, 2026-11-17: "que el pedido pase solo a pedido
 * confirmado"), así aparece en Pedidos y en la cola de impresión sin volver a
 * cargar nada. El precio y el costo son los que puso el operador al responder.
 *
 * Primero se TOMA la consulta (answered → confirmed en una sentencia) y recién
 * después se crea la venta: dos toques seguidos no pueden crear dos pedidos.
 * Si la venta falla, la consulta vuelve a "respondida".
 */
async function confirmInquiry(
  id: string,
  paymentMethod: InquiryPaymentMethod,
  actor: Actor,
): Promise<repo.Inquiry> {
  const before = await repo.findInquiryById(id);
  if (!before) throw new NotFoundError("La consulta ya no existe.");
  if (before.status !== "answered") {
    throw new ValidationError(
      "Solo se puede confirmar una consulta que ya tiene respuesta.",
    );
  }
  const unitPrice = Number(before.unitPrice);
  const unitCost = Number(before.unitCost);
  const grams = Number(before.estGrams ?? 0);
  const minutes = before.estMinutes ?? 0;
  // Lo calculado por el operador: el costo lo resuelve el servidor desde el
  // filamento (y se descuenta su stock), igual que una venta cargada a mano.
  const fromCalc =
    (before.estFilamentId != null || before.estMaterial != null) &&
    (grams > 0 || minutes > 0);
  if (!(unitPrice > 0) || (!fromCalc && !(unitCost > 0))) {
    throw new ValidationError(
      "A la respuesta le falta el cálculo del costo. Pedile al operador que calcule el precio de nuevo y volvé a confirmar.",
    );
  }
  const claimed = await repo.claimInquiryConfirmation(id);
  if (!claimed) {
    throw new ValidationError("La consulta cambió. Actualizá la página.");
  }
  let row = claimed;
  try {
    const sale = await registerManualSale({
      input: {
        saleDate: todayAr(),
        customerName: claimed.customerName,
        detail: claimed.title.slice(0, 300),
        quantity: claimed.quantity,
        total: unitPrice * claimed.quantity,
        paymentMethod,
        status: "confirmed",
        ...(fromCalc
          ? {
              filamentId: before.estFilamentId ?? undefined,
              material: before.estMaterial ?? undefined,
              grams,
              printMinutes: minutes,
            }
          : {}),
      },
      actorId: actor.id,
      ...(fromCalc ? {} : { manualCost: unitCost * claimed.quantity }),
    });
    row = (await repo.setInquirySale(id, sale.id)) ?? claimed;
  } catch (error) {
    await repo.setInquiryStatus(id, "answered");
    throw error;
  }
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.status_changed",
    entityType: "inquiry",
    entityId: id,
    metadata: {
      title: row.title,
      from: "answered",
      to: "confirmed",
      saleId: row.saleId,
    },
  });
  await notify(
    "inquiry_confirmed",
    "Consulta CONFIRMADA → pedido creado",
    `${row.title}${times(row.quantity)} — ${row.customerName}`,
    actor,
  );
  revalidatePath(PAGE);
  revalidatePath("/admin/produccion");
  return row;
}

/** Confirmar / no se hizo / reabrir (atención al cliente). */
export async function changeInquiryStatus(
  id: string,
  to: InquiryStatusChange,
  actor: Actor,
  paymentMethod: InquiryPaymentMethod = "transfer",
): Promise<repo.Inquiry> {
  if (to === "confirmed") return confirmInquiry(id, paymentMethod, actor);
  const before = await repo.findInquiryById(id);
  if (!before) throw new NotFoundError("La consulta ya no existe.");
  if (to === "reopen" && before.saleId) {
    // El pedido ya existe: reabrir y volver a confirmar lo duplicaría.
    throw new ValidationError(
      "Esta consulta ya generó un pedido. Si hay que cambiar algo, editá el pedido.",
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
  revalidatePath(PAGE);
  return row;
}

/**
 * Suma un adjunto que no es foto (el audio que mandó el cliente, un PDF, un
 * video corto). Lo puede sumar quien cargó la consulta o quien la responde,
 * así todo queda en la misma consulta.
 */
export async function addInquiryFile(
  id: string,
  file: { bytes: Buffer; name: string; type: string },
  actor: Actor,
  canEdit: boolean,
): Promise<{ url: string; name: string; type: string }> {
  const row = await repo.findInquiryById(id);
  if (!row) throw new NotFoundError("La consulta ya no existe.");
  if (row.createdBy !== actor.id && !canEdit) throw new UnauthorizedError();
  if (!isAllowedInquiryFile(file.type)) {
    throw new ValidationError("Se pueden adjuntar audios, videos o PDF.");
  }
  if (file.bytes.length > MAX_INQUIRY_FILE_BYTES) {
    throw new ValidationError("El archivo supera los 4 MB.");
  }
  const full = `Máximo ${MAX_INQUIRY_FILES} archivos por consulta.`;
  if (row.files.length >= MAX_INQUIRY_FILES) throw new ValidationError(full);
  const name = file.name
    .replace(/[\r\n]/g, " ")
    .trim()
    .slice(0, 120);
  const ext = /\.([a-z0-9]{1,5})$/i.exec(name)?.[1]?.toLowerCase() ?? "bin";
  const path = `${PREFIX}/${id}/files/${randomUUID()}.${ext}`;
  const url = await uploadObject(BUCKET, path, file.bytes, file.type);
  const saved = { url, name: name || "archivo", type: file.type };
  if (!(await repo.appendInquiryFile(id, saved, MAX_INQUIRY_FILES))) {
    await deleteObject(BUCKET, path).catch(() => undefined);
    throw new ValidationError(full);
  }
  revalidatePath(PAGE);
  return saved;
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
  for (const url of [...row.images, ...row.files.map((f) => f.url)]) {
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
