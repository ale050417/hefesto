import { revalidatePath } from "next/cache";
import { recordAudit } from "@/core/audit";
import { NotFoundError, UnauthorizedError } from "@/core/errors";
import * as repo from "./repository";
import type { TaskCreateInput } from "./schemas";

// Pendientes del equipo (pedido de Agustín, 2026-11-17). Viven en la página de
// Pedidos: cada cambio la refresca para que lo vea el resto al recargar.
const PAGE = "/admin/pedidos";
const GONE = "Ese pendiente ya no existe (alguien lo borró).";

type Actor = { id: string; name: string | null };

/** Recorte para la auditoría: alcanza para reconocer el pendiente. */
function excerpt(body: string): string {
  return body.length > 80 ? `${body.slice(0, 80)}…` : body;
}

export async function createTask(
  input: TaskCreateInput,
  actor: Actor,
): Promise<repo.TeamTask> {
  const task = await repo.insertTask({
    body: input.body,
    createdBy: actor.id,
    createdByName: actor.name,
  });
  await recordAudit({
    actorId: actor.id,
    action: "team_task.created",
    entityType: "team_task",
    entityId: task.id,
    metadata: { body: excerpt(task.body) },
  });
  revalidatePath(PAGE);
  return task;
}

/** Tilda o destilda. Cualquiera del equipo puede, no solo quien lo anotó. */
export async function setTaskDone(
  id: string,
  done: boolean,
  actor: Actor,
): Promise<repo.TeamTask> {
  const before = await repo.findTaskById(id);
  if (!before) throw new NotFoundError(GONE);
  // Dos personas tildando lo mismo a la vez: la segunda no pisa el nombre ni
  // la hora de la primera, y no se ensucia la auditoría.
  if (before.done === done) return before;
  const task = await repo.updateTaskDone(id, { done, doneByName: actor.name });
  if (!task) throw new NotFoundError(GONE);
  await recordAudit({
    actorId: actor.id,
    action: done ? "team_task.done" : "team_task.reopened",
    entityType: "team_task",
    entityId: id,
    metadata: { body: excerpt(task.body) },
  });
  revalidatePath(PAGE);
  return task;
}

/**
 * Borra un pendiente: quien lo anotó, o quien puede eliminar en Pedidos. Si ya
 * no existe no es un error (otro lo borró antes).
 */
export async function deleteTask(
  id: string,
  actor: Actor,
  canDelete: boolean,
): Promise<void> {
  const task = await repo.findTaskById(id);
  if (!task) return;
  if (!canDelete && task.createdBy !== actor.id) throw new UnauthorizedError();
  await repo.deleteTaskRow(id);
  await recordAudit({
    actorId: actor.id,
    action: "team_task.deleted",
    entityType: "team_task",
    entityId: id,
    metadata: { body: excerpt(task.body), author: task.createdByName },
  });
  revalidatePath(PAGE);
}
