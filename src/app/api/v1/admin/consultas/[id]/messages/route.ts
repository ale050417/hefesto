import { z } from "zod";
import { apiError, apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { apiActor } from "@/core/api/upload";
import type { ApiUser } from "@/core/auth/api-auth";
import { canForUser } from "@/core/auth/permissions";
import { getChat, postChatMessage } from "@/features/consultas/chat";
import { MAX_CHAT_BODY, chatMessageSchema } from "@/features/consultas/schemas";
import { businessError } from "@/features/inventory/api-helpers";

/**
 * /api/v1/admin/consultas/:id/messages — chat en vivo dentro de una consulta
 * (pedido de Ale, 2026-11-25): la vendedora y el operador conversan ahí, con
 * texto y fotos. Hace falta ver consultas y poder cargarlas o responderlas.
 *
 *  - GET  → { "items": [Message, ...], "maxLength": 2000 } en orden (el más
 *           viejo primero; como mucho los últimos 300). Con `?after=<ISO>`
 *           (el `createdAt` del último mensaje que ya se tiene) devuelve solo
 *           los nuevos: es lo que se pide cada pocos segundos con el chat
 *           abierto. Leer marca la conversación como leída por quien consulta.
 *  - POST → manda un mensaje. JSON `{ "body": "texto" }`, o multipart con
 *           `body` (opcional) y `file` (UNA foto JPG/PNG/WebP de hasta 4 MB).
 *           Hace falta texto, foto o las dos. Responde 201 con el Message y
 *           le avisa al resto del equipo (tipo de aviso `inquiry_message`).
 *
 * Message:
 *   {
 *     "id": "uuid",
 *     "author": "Antonella",
 *     "mine": true,                      // lo mandó quien consulta
 *     "body": "Lo quiere de 12 cm",      // puede ser "" si es solo una foto
 *     "image": "https://…/foto.webp",    // o null
 *     "createdAt": "2026-11-25T14:03:11.000Z"
 *   }
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;

/** Puede chatear quien carga consultas o quien las responde. */
async function canChat(user: ApiUser): Promise<boolean> {
  const [create, edit] = await Promise.all([
    canForUser(user, "consultas", "crear"),
    canForUser(user, "consultas", "editar"),
  ]);
  return create || edit;
}

export const GET = withApi(
  "admin/consultas/messages",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "ver");
    if ("response" in auth) return auth.response;
    if (!(await canChat(auth.user))) {
      return apiError("forbidden", "No tenés permiso para hacer esto.");
    }
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");
    const raw = new URL(request.url).searchParams.get("after");
    const after = raw ? new Date(raw) : null;
    const items = await getChat(
      id.data,
      apiActor(auth.user),
      after && !Number.isNaN(after.getTime()) ? after : null,
    );
    return apiOk({ items, maxLength: MAX_CHAT_BODY });
  },
);

export const POST = withApi(
  "admin/consultas/messages/send",
  async (request: Request, ctx: Ctx) => {
    const auth = await requireApiPerm(request, "consultas", "ver");
    if ("response" in auth) return auth.response;
    if (!(await canChat(auth.user))) {
      return apiError("forbidden", "No tenés permiso para hacer esto.");
    }
    const id = z.uuid().safeParse((await ctx.params).id);
    if (!id.success) return apiError("invalid", "Consulta inválida.");

    let rawBody: unknown = "";
    let image: Buffer | null = null;
    if ((request.headers.get("content-type") ?? "").includes("multipart/")) {
      const form = await request.formData().catch(() => null);
      if (!form) return apiError("invalid", "Mensaje inválido.");
      rawBody = String(form.get("body") ?? "");
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          return apiError("invalid", "Formato no permitido (JPG, PNG o WebP)");
        }
        if (file.size > MAX_BYTES) {
          return apiError(
            "invalid",
            "La foto pesa más de 4 MB. Probá con una más liviana.",
          );
        }
        image = Buffer.from(await file.arrayBuffer());
      }
    } else {
      const json = (await request.json().catch(() => null)) as {
        body?: unknown;
      } | null;
      rawBody = json?.body ?? "";
    }
    const parsed = chatMessageSchema.safeParse({ body: rawBody });
    if (!parsed.success) {
      return apiError(
        "invalid",
        parsed.error.issues[0]?.message ?? "Revisá el mensaje.",
      );
    }
    try {
      const message = await postChatMessage(
        id.data,
        { body: parsed.data.body, image },
        apiActor(auth.user),
      );
      return apiOk(message, { status: 201 });
    } catch (error) {
      const mapped = businessError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
