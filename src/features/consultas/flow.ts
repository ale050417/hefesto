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
import {
  deleteManualSale,
  getManualSale,
  updateManualSaleStatus,
} from "@/features/orders/services/manualSaleService";
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

/** Hoy en Argentina, como lo manda el formulario de ventas (AAAA-MM-DD). */
function todayAr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());
}

/** Lo que hace falta de una consulta cotizada para armar su pedido. */
type Quoted = {
  customerName: string;
  title: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
  filamentId: string | null;
  material: string | null;
  grams: number;
  printMinutes: number;
};

/** ¿Alcanza lo cargado para costear el pedido? */
function quoteHasCost(q: Quoted): { fromCalc: boolean; ok: boolean } {
  const fromCalc =
    (q.filamentId != null || q.material != null) &&
    (q.grams > 0 || q.printMinutes > 0);
  return {
    fromCalc,
    ok: q.unitPrice > 0 && (fromCalc || (q.unitCost ?? 0) > 0),
  };
}

/**
 * Crea el pedido de una consulta cotizada. El costo lo resuelve el servidor
 * desde lo que cargó el operador en la calculadora (filamento + gramos +
 * minutos), igual que una venta cargada a mano; si cargó el costo a mano, va
 * ese. En "pendiente de pago" no descuenta filamento: eso pasa al confirmar.
 */
async function createInquirySale(
  q: Quoted,
  status: "pending_payment" | "confirmed",
  paymentMethod: InquiryPaymentMethod,
  actor: Actor,
) {
  const { fromCalc, ok } = quoteHasCost(q);
  if (!ok) {
    throw new ValidationError(
      "A la cotización le falta el cálculo del costo. Calculá el precio con la calculadora y volvé a crearla.",
    );
  }
  return registerManualSale({
    input: {
      saleDate: todayAr(),
      customerName: q.customerName,
      detail: q.title.slice(0, 300),
      quantity: q.quantity,
      total: q.unitPrice * q.quantity,
      paymentMethod,
      status,
      ...(fromCalc
        ? {
            filamentId: q.filamentId ?? undefined,
            material: q.material ?? undefined,
            grams: q.grams,
            printMinutes: q.printMinutes,
          }
        : {}),
    },
    actorId: actor.id,
    ...(fromCalc ? {} : { manualCost: (q.unitCost ?? 0) * q.quantity }),
  });
}

/** Los números de una consulta ya cotizada (lo que guardó el operador). */
function quotedOf(row: repo.Inquiry): Quoted {
  return {
    customerName: row.customerName,
    title: row.title,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
    unitCost: row.unitCost == null ? null : Number(row.unitCost),
    filamentId: row.estFilamentId,
    material: row.estMaterial,
    grams: Number(row.estGrams ?? 0),
    printMinutes: row.estMinutes ?? 0,
  };
}

/** Borra el pedido de una cotización SOLO si sigue sin cobrarse. */
async function dropPendingSale(saleId: string | null): Promise<void> {
  if (!saleId) return;
  const sale = await getManualSale(saleId);
  if (!sale) return;
  if (sale.status === "pending_payment" || sale.status === "cancelled") {
    await deleteManualSale(saleId);
  }
}

/**
 * "Crear cotización" (pedido de Ale, 2026-11-25): el operador, con la pieza ya
 * modelada y el precio calculado, guarda la cotización. Queda armado el
 * mensaje para el cliente (el que escribió el operador, o el automático) y se
 * crea SOLO el pedido en "pendiente de pago", que ya se ve en Pedidos. La
 * vendedora copia o manda el mensaje y, cuando el cliente seña, lo confirma.
 *
 * Volver a cotizar reemplaza el pedido pendiente por uno con los números
 * nuevos. El pedido se crea ANTES de guardar la cotización: si el costo no se
 * puede calcular, no queda nada a medias.
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
  const sale = await createInquirySale(
    {
      customerName: before.customerName,
      title: before.title,
      quantity: before.quantity,
      unitPrice: input.unitPrice,
      unitCost: input.unitCost,
      filamentId: input.filamentId,
      material: input.material,
      grams: input.grams ?? 0,
      printMinutes: input.printMinutes ?? 0,
    },
    "pending_payment",
    "transfer",
    actor,
  );
  const saved = await repo.saveInquiryAnswer(id, {
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
  if (!saved) {
    await deleteManualSale(sale.id).catch(() => undefined);
    throw new ValidationError("La consulta cambió. Actualizá la página.");
  }
  const row = (await repo.setInquirySale(id, sale.id)) ?? saved;
  // La cotización anterior (si había) deja de valer: se va su pedido pendiente.
  if (before.saleId && before.saleId !== sale.id) {
    await dropPendingSale(before.saleId).catch((error) =>
      console.error("[consultas] no se pudo quitar el pedido anterior:", error),
    );
  }
  await recordAudit({
    actorId: actor.id,
    action: "inquiry.answered",
    entityType: "inquiry",
    entityId: id,
    metadata: {
      title: row.title,
      unitPrice: input.unitPrice,
      saleId: sale.id,
    },
  });
  await notify(
    "inquiry_answered",
    "Cotización lista · pendiente de pago",
    `${row.title} — ${formatQuoteMoney(input.unitPrice)}${row.quantity > 1 ? " c/u" : ""} · ${row.customerName}`,
    actor,
  );
  revalidatePath(PAGE);
  revalidatePath("/admin/pedidos");
  return row;
}

/**
 * Confirmar (el cliente señó): el pedido de la cotización pasa de "pendiente
 * de pago" a "confirmado", entra a la cola de impresión y ahí se descuenta el
 * filamento. Se elige cómo pagó.
 *
 * Las cotizaciones viejas (de antes del 2026-11-25) no tienen pedido: para
 * esas se crea directo en "confirmado", como se hacía.
 *
 * Primero se TOMA la consulta (answered → confirmed en una sentencia) y recién
 * después se toca el pedido: dos toques seguidos no pueden confirmar dos
 * veces. Si falla, la consulta vuelve a "cotizada".
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
  const quoted = quotedOf(before);
  if (!before.saleId && !quoteHasCost(quoted).ok) {
    throw new ValidationError(
      "A la cotización le falta el cálculo del costo. Pedile al operador que la cree de nuevo y volvé a confirmar.",
    );
  }
  const claimed = await repo.claimInquiryConfirmation(id);
  if (!claimed) {
    throw new ValidationError("La consulta cambió. Actualizá la página.");
  }
  let row = claimed;
  try {
    if (before.saleId) {
      // El pedido ya existe (se creó con la cotización): pasa a confirmado.
      await repo.setSalePaymentMethod(before.saleId, paymentMethod);
      await updateManualSaleStatus(before.saleId, "confirmed");
    } else {
      const sale = await createInquirySale(
        quoted,
        "confirmed",
        paymentMethod,
        actor,
      );
      row = (await repo.setInquirySale(id, sale.id)) ?? claimed;
    }
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
    "Consulta CONFIRMADA → pedido a producción",
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
  if (to === "reopen" && before.saleId && before.status === "confirmed") {
    // El pedido ya está confirmado: reabrir y volver a confirmar lo duplicaría.
    throw new ValidationError(
      "Esta consulta ya generó un pedido. Si hay que cambiar algo, editá el pedido.",
    );
  }
  const next = to === "reopen" ? (before.message ? "answered" : "pending") : to;
  if (next === before.status) return before;
  // El pedido pendiente acompaña a la cotización: si no se hizo, se cancela;
  // si se reabre, vuelve a esperar el pago.
  if (before.saleId && next === "cancelled") {
    await updateManualSaleStatus(
      before.saleId,
      "cancelled",
      "La consulta no se hizo",
    );
  }
  if (before.saleId && next === "answered") {
    const sale = await getManualSale(before.saleId);
    if (!sale || sale.status === "cancelled") {
      // Cancelado es un estado final: se arma de nuevo el pedido pendiente.
      if (sale) await deleteManualSale(before.saleId);
      const fresh = await createInquirySale(
        quotedOf(before),
        "pending_payment",
        "transfer",
        actor,
      );
      await repo.setInquirySale(id, fresh.id);
    }
  }
  const row = await repo.setInquiryStatus(id, next);
  if (!row) throw new NotFoundError("La consulta ya no existe.");
  revalidatePath("/admin/pedidos");
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
  // Una cotización sin cobrar no deja un pedido huérfano en Pedidos. Un pedido
  // ya confirmado NO se toca: es una venta real.
  if (row.status !== "confirmed") {
    await dropPendingSale(row.saleId).catch(() => undefined);
  }
  const chatImages = await repo.listInquiryChatImages(id).catch(() => []);
  await repo.deleteInquiryRow(id);
  for (const url of [
    ...row.images,
    ...row.files.map((f) => f.url),
    ...chatImages,
  ]) {
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
