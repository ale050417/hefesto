import { randomUUID } from "node:crypto";
import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/core/errors";
import { optimizeImage, uploadObject } from "@/core/storage";
import * as repo from "./repository";
import type { CustomRequestInput } from "./schemas";
import { canQuote, canTransitionCustom } from "./transitions";
import type {
  CustomMessage,
  CustomRequest,
  CustomRequestStatus,
} from "./types";

// Tipo público del service (la UI no debe importar del repository — Cap. 5).
export type { AdminRequestRow } from "./repository";

// Reusamos el bucket público "products" (como settings) con prefijo "custom/".
const CHAT_BUCKET = "products";

export async function createCustomRequest(
  customerId: string,
  input: CustomRequestInput,
): Promise<CustomRequest> {
  return repo.createRequest({
    customerId,
    title: input.title,
    description: input.description,
    referenceImageUrl: input.referenceImageUrl || null,
    budget: input.budget != null ? String(input.budget) : null,
  });
}

export async function listCustomerRequests(customerId: string) {
  return repo.listByCustomer(customerId);
}

export async function listAdminRequests() {
  return repo.listAll();
}

/** Listado del panel con nombre/teléfono del cliente y último mensaje. */
export async function listAdminRequestsWithMeta() {
  return repo.listAllWithMeta();
}

/** "Por responder": el último mensaje lo escribió el cliente (no el taller). */
export function requestNeedsReply(row: repo.AdminRequestRow): boolean {
  return row.lastMessage != null && !row.lastMessage.fromStaff;
}

/** Devuelve la solicitud (verificando dueño si se pasa customerId) + mensajes. */
export async function getRequestWithMessages(
  id: string,
  customerId?: string,
): Promise<{ request: CustomRequest; messages: CustomMessage[] }> {
  const request = await repo.getRequestById(id);
  if (!request || (customerId && request.customerId !== customerId)) {
    throw new NotFoundError("No encontramos la solicitud.");
  }
  const messages = await repo.listMessages(id);
  return { request, messages };
}

export async function sendMessage(params: {
  requestId: string;
  fromStaff: boolean;
  authorId: string | null;
  body: string;
  imageUrl?: string | null;
}): Promise<CustomMessage> {
  return repo.addMessage({
    requestId: params.requestId,
    fromStaff: params.fromStaff,
    authorId: params.authorId,
    body: params.body,
    imageUrl: params.imageUrl ?? null,
  });
}

/** Optimiza (WebP) y sube una foto del chat; devuelve la URL pública. */
export async function uploadChatImage(
  requestId: string,
  bytes: Buffer,
): Promise<string> {
  const webp = await optimizeImage(bytes);
  const path = `custom/${requestId}/${randomUUID()}.webp`;
  return uploadObject(CHAT_BUCKET, path, webp, "image/webp");
}

/** Borra una solicitud y, por cascade en la FK, sus mensajes. */
export async function deleteRequest(id: string): Promise<void> {
  const request = await repo.getRequestById(id);
  if (!request) throw new NotFoundError("No encontramos la solicitud.");
  await repo.deleteRequest(id);
}

/**
 * Admin: cotiza o re-cotiza. pending → quoted (primera cotización) o
 * quoted → quoted (editar el monto). Otros estados no se pueden cotizar.
 */
export async function quoteRequest(id: string, amount: number) {
  const request = await repo.getRequestById(id);
  if (!request) throw new NotFoundError("No encontramos la solicitud.");
  if (!canQuote(request.status)) {
    throw new ValidationError(
      "Solo se puede cotizar una solicitud pendiente o ya cotizada.",
    );
  }
  return repo.updateRequest(id, {
    quotedAmount: String(amount),
    status: "quoted",
  });
}

/** Cambia el estado validando la máquina de estados. */
export async function transitionRequest(
  id: string,
  toStatus: CustomRequestStatus,
) {
  const request = await repo.getRequestById(id);
  if (!request) throw new NotFoundError("No encontramos la solicitud.");
  if (!canTransitionCustom(request.status, toStatus)) {
    throw new InvalidTransitionError(
      `No se puede pasar de "${request.status}" a "${toStatus}".`,
    );
  }
  return repo.updateRequest(id, { status: toStatus });
}

/** Cliente: acepta la cotización (quoted → approved). */
export async function approveQuote(id: string, customerId: string) {
  const request = await repo.getRequestById(id);
  if (!request || request.customerId !== customerId) {
    throw new NotFoundError("No encontramos la solicitud.");
  }
  if (request.status !== "quoted") {
    throw new ValidationError("La solicitud no está cotizada.");
  }
  return repo.updateRequest(id, { status: "approved" });
}
