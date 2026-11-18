// Lecturas para páginas y rutas (la UI no importa el repository directo).
import * as repo from "./repository";
import { DONE_TASKS_SHOWN } from "./schemas";
import { toTaskView, type TeamTaskLists } from "./view";

/**
 * Los pendientes abiertos (más nuevos primero) y los últimos hechos, ya
 * armados para quien los mira (`mine` depende del usuario).
 */
export async function listTeamTasks(
  viewerId: string | null,
): Promise<TeamTaskLists> {
  const [open, done] = await Promise.all([
    repo.listOpenTasks(),
    repo.listDoneTasks(DONE_TASKS_SHOWN),
  ]);
  return {
    open: open.map((t) => toTaskView(t, viewerId)),
    done: done.map((t) => toTaskView(t, viewerId)),
  };
}
