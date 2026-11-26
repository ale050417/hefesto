import { randomUUID } from "node:crypto";
import { NotFoundError, ValidationError } from "@/core/errors";
import { storeImage } from "@/core/storage";
import { notifyAdmins } from "@/features/notifications/service";
import * as repo from "./repository";
import { MAX_CHAT_BODY } from "./schemas";

/**
 * Chat en vivo dentro de cada consulta (pedido de Ale, 2026-11-25): la
 * vendedora carga la consulta del cliente y ahí mismo conversa con el operador
 * (texto y fotos) hasta dejar todo definido. Después el operador modela, saca
 * el precio y crea la cotización (ver flow.ts).
 *
 * Lo comparten el panel web (actions.ts) y la API de la app. La autorización
 * (ver consultas + poder cargarlas o responderlas) la valida cada caller.
 */

// Mismo bucket público que las fotos de la consulta, en su carpeta.
const BUCKET = "products";
const PAGE = "/admin/consultas";

export type ChatActor = { id: string; name: string | null };

/** Un mensaje como lo ven la web y la app. */
export type ChatMessageView = {
  id: string;
  author: string;
  /** Lo escribió quien está mirando. */
  mine: boolean;
  body: string;
  image: string | null;
  createdAt: string;
};

export function toChatMessageView(
  row: repo.InquiryMessage,
  viewerId: string | null,
): ChatMessageView {
  return {
    id: row.id,
    author: row.authorName ?? "Alguien del equipo",
    mine: viewerId != null && row.authorId === viewerId,
    body: row.body,
    image: row.image,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Mensajes de la conversación (con `after`, solo los nuevos desde esa fecha).
 * Leerlos la marca como leída para quien mira.
 */
export async function getChat(
  inquiryId: string,
  viewer: ChatActor,
  after?: Date | null,
): Promise<ChatMessageView[]> {
  const rows = await repo.listInquiryMessages(inquiryId, after);
  // Sin mensajes nuevos no hace falta tocar la marca de lectura.
  if (!after || rows.length > 0) {
    await repo.markInquiryRead(inquiryId, viewer.id);
  }
  return rows.map((r) => toChatMessageView(r, viewer.id));
}

/** Texto corto del aviso: lo que se escribió, o que mandó una foto. */
export function chatPreview(body: string, hasImage: boolean): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text) return hasImage ? "📷 Foto" : "";
  const short = text.length > 90 ? `${text.slice(0, 89)}…` : text;
  return hasImage ? `📷 ${short}` : short;
}

/**
 * Manda un mensaje: texto, una foto o las dos cosas. Le avisa al resto del
 * equipo que ve consultas (campana + push), no a quien lo mandó.
 */
export async function postChatMessage(
  inquiryId: string,
  input: { body: string; image?: Buffer | null },
  actor: ChatActor,
): Promise<ChatMessageView> {
  const body = input.body.trim();
  if (!body && !input.image) {
    throw new ValidationError("Escribí un mensaje o adjuntá una foto.");
  }
  if (body.length > MAX_CHAT_BODY) {
    throw new ValidationError(`Máximo ${MAX_CHAT_BODY} caracteres.`);
  }
  const inquiry = await repo.findInquiryById(inquiryId);
  if (!inquiry) throw new NotFoundError("La consulta ya no existe.");

  let image: string | null = null;
  if (input.image) {
    const stored = await storeImage(
      BUCKET,
      `consultas/${inquiryId}/chat/${randomUUID()}`,
      input.image,
    );
    image = stored.url;
  }
  const row = await repo.insertInquiryMessage({
    inquiryId,
    authorId: actor.id,
    authorName: actor.name,
    body,
    image,
  });
  // Quien escribe ya leyó todo lo anterior.
  await repo.markInquiryRead(inquiryId, actor.id).catch(() => undefined);
  await notifyAdmins({
    kind: "inquiry_message",
    title: `${actor.name ?? "Mensaje"} · ${inquiry.title}`,
    body: `${chatPreview(body, !!image)} — ${inquiry.customerName}`,
    link: PAGE,
    actorId: actor.id,
  }).catch(() => undefined);
  return toChatMessageView(row, actor.id);
}
