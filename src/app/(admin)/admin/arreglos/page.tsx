import { requirePermissionPage } from "@/core/auth/permissions";
import { getCurrentUser } from "@/core/auth/session";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { safeLoad } from "@/lib/safe-load";
import { NuevoArregloButton } from "@/features/arreglos/components/nuevo-arreglo-button";
import { FixList, type FixRow } from "@/features/arreglos/components/fix-list";
import { listFixes } from "@/features/arreglos/queries";
import type { FixStatus } from "@/features/arreglos/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Arreglos" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * Arreglos (pedido de Ale, 2026-11-17): el operador carga lo que hay que
 * arreglar o mejorar, con fotos; el dueño lo ve acá, responde y lo marca
 * resuelto.
 */
export default async function ArreglosPage() {
  await requirePermissionPage("arreglos", "ver");
  const [user, fixesR] = await Promise.all([
    getCurrentUser(),
    safeLoad("arreglos", listFixes(), []),
  ]);

  const rows: FixRow[] = fixesR.value.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    urgent: f.urgent,
    status: f.status as FixStatus,
    images: f.images,
    ownerNote: f.ownerNote,
    author: f.createdByName ?? "Alguien del equipo",
    mine: !!user && f.createdBy === user.id,
    createdAt: dateFmt.format(f.createdAt),
    resolvedAt: f.resolvedAt ? dateFmt.format(f.resolvedAt) : null,
  }));

  return (
    <div className="view grid gap-5">
      <DegradedNotice sources={fixesR.ok ? [] : ["los arreglos"]} />
      <div className="page-head">
        <div>
          <div className="eyebrow">Mejoras de la web y del taller</div>
          <h1 className="page-title">Arreglos</h1>
          <div className="page-sub">
            Anotá lo que hay que arreglar o mejorar, con fotos y la explicación
          </div>
        </div>
        <NuevoArregloButton />
      </div>

      {rows.length === 0 && fixesR.ok ? (
        <div className="ui-card section-card text-dim p-10 text-center">
          Todavía no hay arreglos cargados.
        </div>
      ) : (
        <FixList fixes={rows} />
      )}
    </div>
  );
}
