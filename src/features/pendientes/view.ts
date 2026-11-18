import type { TeamTask } from "./repository";

/** Pendiente listo para mostrar (web y app). Fechas en ISO 8601 (UTC). */
export type TeamTaskView = {
  id: string;
  body: string;
  done: boolean;
  /** Quién lo anotó (nombre guardado al anotarlo). */
  author: string;
  /** Lo anotó el usuario que está mirando (puede borrarlo). */
  mine: boolean;
  createdAt: string;
  /** Quién lo tildó; null mientras siga abierto. */
  doneBy: string | null;
  doneAt: string | null;
};

export type TeamTaskLists = { open: TeamTaskView[]; done: TeamTaskView[] };

export function toTaskView(
  row: TeamTask,
  viewerId: string | null,
): TeamTaskView {
  return {
    id: row.id,
    body: row.body,
    done: row.done,
    author: row.createdByName ?? "Alguien del equipo",
    mine: viewerId != null && row.createdBy === viewerId,
    createdAt: row.createdAt.toISOString(),
    doneBy: row.done ? (row.doneByName ?? "Alguien del equipo") : null,
    doneAt: row.doneAt?.toISOString() ?? null,
  };
}
