"use server";

import { z } from "zod";
import { getCurrentUser } from "@/core/auth/session";
import { can } from "@/core/auth/permissions";
import { type ActionResult, toActionError } from "@/core/errors";
import { taskCreateSchema, taskDoneSchema } from "./schemas";
import * as service from "./service";

// Los pendientes usan los permisos del módulo Pedidos (pedido de Agustín,
// 2026-11-17): "crear" para anotar y para tildar; borrar, quien lo anotó o
// quien tenga "eliminar".

const NOT_STAFF = {
  ok: false as const,
  error: { code: "UNAUTHORIZED", message: "No autorizado" },
};

const idSchema = z.uuid();

function invalid(message: string) {
  return { ok: false as const, error: { code: "VALIDATION", message } };
}

async function currentActor() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { id: user.id, name: user.profile?.fullName ?? user.email ?? null };
}

export async function createTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await can("pedidos", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsed = taskCreateSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "Revisá el texto.");
  }
  try {
    const task = await service.createTask(parsed.data, actor);
    return { ok: true, data: { id: task.id } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function setTaskDoneAction(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!(await can("pedidos", "crear"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  const parsed = taskDoneSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return invalid("Pendiente inválido.");
  }
  try {
    await service.setTaskDone(parsedId.data, parsed.data.done, actor);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  // "ver" alcanza para entrar: el service decide si puede borrar ESTE
  // pendiente (permiso "eliminar", o lo anotó él).
  if (!(await can("pedidos", "ver"))) return NOT_STAFF;
  const actor = await currentActor();
  if (!actor) return NOT_STAFF;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return invalid("Pendiente inválido.");
  try {
    await service.deleteTask(
      parsedId.data,
      actor,
      await can("pedidos", "eliminar"),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
