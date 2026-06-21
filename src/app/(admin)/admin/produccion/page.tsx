import { requireStaff } from "@/core/auth/session";
import { getBoard } from "@/features/production/service";
import { ProductionBoard } from "@/features/production/components/production-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Producción — Admin" };

export default async function ProductionPage() {
  await requireStaff();
  const { printers, jobs } = await getBoard();
  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Taller</div>
          <h1 className="page-title">Producción</h1>
        </div>
      </div>
      <ProductionBoard printers={printers} jobs={jobs} />
    </div>
  );
}
