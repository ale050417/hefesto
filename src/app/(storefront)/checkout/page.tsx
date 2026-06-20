import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { isMercadoPagoConfigured } from "@/core/payments/mercadopago";
import { CheckoutStepper } from "@/features/orders/components/checkout-stepper";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  // Checkout requiere sesión: el pedido se asocia al usuario logueado.
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?redirect=/checkout");

  return (
    <div className="store-wrap max-w-5xl py-10">
      <nav className="text-dim text-sm">
        <Link href="/" className="hover:text-fg">
          Inicio
        </Link>{" "}
        / <span className="text-fg">Checkout</span>
      </nav>
      <h1 className="font-display text-fg mt-2 mb-8 text-3xl">
        Finalizar compra
      </h1>
      <CheckoutStepper mpEnabled={isMercadoPagoConfigured()} />
    </div>
  );
}
