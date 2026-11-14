import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  gte,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/core/db";
import { auditLog, profiles } from "@/core/db/schema";
import { ACTION_LABEL, labelOf } from "./labels";

/**
 * Lectura paginada y filtrable del registro de auditoría para la app móvil
 * (`/api/v1/admin/auditoria`, 2026-10-31). La web sigue usando
 * `listRecentAudit` (últimas 100); acá agregamos filtros, búsqueda, paginado y
 * detalle sin tocar esa función.
 */

export const AUDIT_DEFAULT_PAGE_SIZE = 30;
export const AUDIT_MAX_PAGE_SIZE = 100;

export type AuditFilters = {
  /** Texto libre: acción (código o en castellano), entidad, id, persona, detalle. */
  q?: string;
  /** Código exacto de acción (`order.status_changed`). */
  action?: string;
  /** Tipo de entidad exacto (`order`, `product`…). */
  entityType?: string;
  /** Uuid del autor, o `"sistema"` para lo que no tiene autor. */
  actor?: string;
  /** Solo lo registrado desde este instante. */
  since?: Date;
};

export type AuditParams = {
  filters: AuditFilters;
  page: number;
  pageSize: number;
  facets: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapa `\`, `%` y `_` para usar el texto del usuario dentro de un LIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

const strip = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Códigos de acción cuyo texto en castellano contiene el término (sin
 * distinguir tildes ni mayúsculas): así "pedido" encuentra `order.*` aunque el
 * código esté en inglés.
 */
export function actionsMatchingLabel(term: string): string[] {
  const t = strip(term.trim());
  if (t.length < 2) return [];
  return Object.entries(ACTION_LABEL)
    .filter(([, label]) => strip(label).includes(t))
    .map(([code]) => code);
}

/**
 * Parámetros de la URL → filtros saneados. Nunca lanza: lo inválido se ignora
 * (la app manda lo que el servidor le ofreció, pero igual no confiamos).
 */
export function parseAuditParams(sp: URLSearchParams): AuditParams {
  const text = (key: string, max: number) => {
    const v = (sp.get(key) ?? "").trim();
    return v.length > 0 ? v.slice(0, max) : undefined;
  };
  const int = (key: string, fallback: number, min: number, max: number) => {
    const n = Number.parseInt(sp.get(key) ?? "", 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };

  const actorRaw = text("actor", 40);
  const actor =
    actorRaw === "sistema" || (actorRaw && UUID_RE.test(actorRaw))
      ? actorRaw
      : undefined;

  const sinceRaw = text("desde", 40);
  const sinceDate = sinceRaw ? new Date(sinceRaw) : null;
  const since =
    sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate : undefined;

  return {
    filters: {
      q: text("q", 80),
      action: text("action", 80),
      entityType: text("entity", 40),
      actor,
      since,
    },
    page: int("page", 1, 1, 10_000),
    pageSize: int("pageSize", AUDIT_DEFAULT_PAGE_SIZE, 1, AUDIT_MAX_PAGE_SIZE),
    facets: sp.get("facets") === "1",
  };
}

function buildWhere(f: AuditFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.action) conds.push(eq(auditLog.action, f.action));
  if (f.entityType) conds.push(eq(auditLog.entityType, f.entityType));
  if (f.actor === "sistema") conds.push(isNull(auditLog.actorId));
  else if (f.actor) conds.push(eq(auditLog.actorId, f.actor));
  if (f.since) conds.push(gte(auditLog.createdAt, f.since));
  if (f.q) {
    const pat = `%${escapeLike(f.q)}%`;
    const byLabel = actionsMatchingLabel(f.q);
    const textMatch = or(
      ilike(auditLog.action, pat),
      ilike(auditLog.entityType, pat),
      ilike(auditLog.entityId, pat),
      ilike(profiles.fullName, pat),
      sql`${auditLog.metadata}::text ilike ${pat}`,
      byLabel.length > 0 ? inArray(auditLog.action, byLabel) : undefined,
    );
    if (textMatch) conds.push(textMatch);
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

const entryColumns = {
  id: auditLog.id,
  action: auditLog.action,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  metadata: auditLog.metadata,
  createdAt: auditLog.createdAt,
  actorId: auditLog.actorId,
  actorName: profiles.fullName,
  actorRole: profiles.role,
};

type EntryRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
};

/** Fila de la base → JSON de la API (fechas ISO, etiqueta en castellano). */
export function serializeAuditEntry(row: EntryRow) {
  return {
    id: row.id,
    action: row.action,
    actionLabel: labelOf(row.action),
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
    actor: row.actorId
      ? { id: row.actorId, name: row.actorName, role: row.actorRole }
      : null,
  };
}

/** Una página del registro (más nuevo primero). Pide uno de más para `hasMore`. */
export async function queryAuditPage(
  filters: AuditFilters,
  page: number,
  pageSize: number,
) {
  const rows = await db
    .select(entryColumns)
    .from(auditLog)
    .leftJoin(profiles, eq(auditLog.actorId, profiles.id))
    .where(buildWhere(filters))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  const hasMore = rows.length > pageSize;
  return {
    items: rows.slice(0, pageSize).map(serializeAuditEntry),
    hasMore,
  };
}

/** Un evento por id, o null si no existe. */
export async function getAuditEntry(id: string) {
  const [row] = await db
    .select(entryColumns)
    .from(auditLog)
    .leftJoin(profiles, eq(auditLog.actorId, profiles.id))
    .where(eq(auditLog.id, id))
    .limit(1);
  return row ? serializeAuditEntry(row) : null;
}

/**
 * Opciones para los filtros de la app: qué acciones, entidades y personas
 * existen en el registro (con cuántos eventos). Se pide solo en la primera
 * página (`facets=1`).
 */
export async function getAuditFacets() {
  const [actions, entities, actors] = await Promise.all([
    db
      .select({ value: auditLog.action, n: count() })
      .from(auditLog)
      .groupBy(auditLog.action)
      .orderBy(desc(count()))
      .limit(100),
    db
      .select({ value: auditLog.entityType, n: count() })
      .from(auditLog)
      .groupBy(auditLog.entityType)
      .orderBy(desc(count()))
      .limit(50),
    db
      .select({ id: auditLog.actorId, name: profiles.fullName, n: count() })
      .from(auditLog)
      .leftJoin(profiles, eq(auditLog.actorId, profiles.id))
      .groupBy(auditLog.actorId, profiles.fullName)
      .orderBy(desc(count()))
      .limit(50),
  ]);
  return {
    actions: actions.map((a) => ({
      value: a.value,
      label: labelOf(a.value),
      count: Number(a.n),
    })),
    entityTypes: entities
      .filter((e) => e.value)
      .map((e) => ({ value: e.value as string, count: Number(e.n) })),
    // Sin autor (acciones del sistema) se ofrece como "sistema".
    actors: actors.map((a) => ({
      id: a.id ?? "sistema",
      name: a.id ? a.name : null,
      count: Number(a.n),
    })),
  };
}
