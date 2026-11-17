import type { FixRequest } from "./repository";
import type { FixStatus } from "./schemas";

/** Arreglo listo para mostrar en la app (fechas ISO). */
export type FixView = {
  id: string;
  title: string;
  description: string;
  urgent: boolean;
  status: FixStatus;
  images: string[];
  ownerNote: string | null;
  author: string;
  /** Lo cargó el usuario que está mirando. */
  mine: boolean;
  createdAt: string;
  resolvedAt: string | null;
};

export function toFixView(row: FixRequest, viewerId: string | null): FixView {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    urgent: row.urgent,
    status: row.status as FixStatus,
    images: row.images,
    ownerNote: row.ownerNote,
    author: row.createdByName ?? "Alguien del equipo",
    mine: viewerId != null && row.createdBy === viewerId,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
