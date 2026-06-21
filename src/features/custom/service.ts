import {
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/core/errors";
import * as repo from "./repository";
import type { CustomRequestInput } from "./schemas";
import { canTransitionCustom } from "./transitions";
import type {
  CustomMessage,
  CustomRequest,
  CustomRequestStatus,
} from "./types";

export async function createCustomRequest(
  customerId: string,
  input: CustomRequestInput,
): Promise<CustomRequest> {
  return repo.createRequest({
    customerId,
    title: input.title,
    description: input.description,
    referenceImageUrl: input.referenceImageUrl || null,
  });
}

export async function listCustomerRequests(customerId: string) {
  return repo.listByCustomer(customerId);
}

export async function listAdminRequests() {
  return repo.listAll();
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
}): Promise<CustomMessage> {
  return repo.addMessage({
    requestId: params.requestId,
    fromStaff: params.fromStaff,
    authorId: params.authorId,
    body: params.body,
  });
}

/** Admin: cotiza (pending → quoted con monto). */
export async function quoteRequest(id: string, amount: number) {
  const request = await repo.getRequestById(id);
  if (!request) throw new NotFoundError("No encontramos la solicitud.");
  if (request.status !== "pending") {
    throw new ValidationError("Solo se puede cotizar una solicitud pendiente.");
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
