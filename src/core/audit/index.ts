import { desc, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { auditLog, profiles } from "@/core/db/schema";

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Registra una acción sensible. Best-effort: nunca rompe la operación. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (error) {
    console.error("[audit] no se pudo registrar:", error);
  }
}

/** Últimas entradas de auditoría (para el panel admin). */
export async function listRecentAudit(limit = 100) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorName: profiles.fullName,
    })
    .from(auditLog)
    .leftJoin(profiles, eq(auditLog.actorId, profiles.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
