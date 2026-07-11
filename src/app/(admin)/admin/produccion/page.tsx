import { requirePermissionPage } from "@/core/auth/permissions";
import { DegradedNotice } from "@/components/shared/degraded-notice";
import { getBoard } from "@/features/production/service";
import { ProductionBoard } from "@/features/production/components/production-board";
import { safeLoad } from "@/lib/safe-load";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de impresión" };

export default async function ProductionPage() {
  await requirePermissionPage("produccion", "ver");
  // Carga acotada: aviso de datos parciales en vez de 504 (2026-07-11).
  const boardR = await safeLoad("cola de impresión", getBoard(), {
    printers: [],
    jobs: [],
  });
  const { printers, jobs } = boardR.value;
  return (
    <div className="view">
      <DegradedNotice sources={boardR.ok ? [] : ["la cola de impresión"]} />
      <ProductionBoard printers={printers} jobs={jobs} />
    </div>
  );
}
