import { notFound } from "next/navigation";
import { FilamentForm } from "@/features/inventory/components/filament-form";
import { getFilament } from "@/features/inventory/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar filamento" };

export default async function EditarFilamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const filament = await getFilament(id);
  if (!filament) notFound();

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventario</div>
          <h1 className="page-title">Editar filamento</h1>
        </div>
      </div>
      <FilamentForm
        id={filament.id}
        defaults={{
          material: filament.material,
          color: filament.color,
          stockGrams: Number(filament.stockGrams),
          alertThresholdGrams: Number(filament.alertThresholdGrams),
        }}
      />
    </div>
  );
}
