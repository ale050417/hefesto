import { requirePermissionPage } from "@/core/auth/permissions";
import { getBoard } from "@/features/production/service";
import { ProductionBoard } from "@/features/production/components/production-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cola de impresión" };

export default async function ProductionPage() {
  await requirePermissionPage("produccion", "ver");
  const { printers, jobs } = await getBoard();
  return (
    <div className="view">
      <ProductionBoard printers={printers} jobs={jobs} />
    </div>
  );
}
