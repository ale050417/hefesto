import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { teamTasks } from "@/core/db/schema";

export type TeamTask = typeof teamTasks.$inferSelect;

/** Pendientes sin tildar, los más nuevos primero. Tope alto: es una lista de
 *  trabajo del día a día, no un histórico. */
export async function listOpenTasks(limit = 200): Promise<TeamTask[]> {
  return db
    .select()
    .from(teamTasks)
    .where(eq(teamTasks.done, false))
    .orderBy(desc(teamTasks.createdAt))
    .limit(limit);
}

/** Los últimos que se tildaron (lo recién hecho arriba). */
export async function listDoneTasks(limit: number): Promise<TeamTask[]> {
  return db
    .select()
    .from(teamTasks)
    .where(eq(teamTasks.done, true))
    .orderBy(desc(teamTasks.doneAt))
    .limit(limit);
}

export async function findTaskById(id: string): Promise<TeamTask | null> {
  const [row] = await db
    .select()
    .from(teamTasks)
    .where(eq(teamTasks.id, id))
    .limit(1);
  return row ?? null;
}

export async function insertTask(values: {
  body: string;
  createdBy: string | null;
  createdByName: string | null;
}): Promise<TeamTask> {
  const [row] = await db.insert(teamTasks).values(values).returning();
  return row!;
}

export async function updateTaskDone(
  id: string,
  values: { done: boolean; doneByName: string | null },
): Promise<TeamTask | null> {
  const [row] = await db
    .update(teamTasks)
    .set({
      done: values.done,
      doneByName: values.done ? values.doneByName : null,
      doneAt: values.done ? new Date() : null,
    })
    .where(eq(teamTasks.id, id))
    .returning();
  return row ?? null;
}

export async function deleteTaskRow(id: string): Promise<void> {
  await db.delete(teamTasks).where(eq(teamTasks.id, id));
}
