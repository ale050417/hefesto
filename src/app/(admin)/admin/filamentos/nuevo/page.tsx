import { FilamentForm } from "@/features/inventory/components/filament-form";

export const metadata = { title: "Nuevo filamento" };

export default function NuevoFilamentoPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventario</div>
          <h1 className="page-title">Nuevo filamento</h1>
        </div>
      </div>
      <FilamentForm />
    </div>
  );
}
