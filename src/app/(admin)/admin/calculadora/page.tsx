import { requireStaff } from "@/core/auth/session";
import { PriceCalculator } from "@/features/calculator/components/price-calculator";

export const metadata = { title: "Calculadora 3D — Admin" };

export default async function CalculatorPage() {
  await requireStaff();
  return (
    <div className="grid gap-5">
      <div className="page-head">
        <div>
          <div className="eyebrow">Herramientas</div>
          <h1 className="page-title">Calculadora de precios 3D</h1>
        </div>
      </div>
      <p className="text-dim max-w-prose text-sm">
        Estimá el precio de una pieza según peso, tiempo, material y margen.
      </p>
      <PriceCalculator />
    </div>
  );
}
