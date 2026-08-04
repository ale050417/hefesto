import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/core/auth/session";
import { isMercadoPagoConfigured } from "@/core/payments/mercadopago";
import { getShippingSettings } from "@/features/settings/service";
import { CheckoutStepper } from "@/features/orders/components/checkout-stepper";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  // Checkout requiere sesión: el pedido se asocia al usuario logueado.
  const user = await getCurrentUser();
  if (!user) redirect("/ingresar?redirect=/checkout");
  // Ciudad + barrios con precio: definen si al cliente se le ofrece "soy de
  // acá" (retiro / envío al barrio) o el formulario del resto del país.
  const s = await getShippingSettings();
  const shipping = {
    city: s?.city ?? null,
    freeOver: Number(s?.freeOver ?? 0),
    zones: s?.zones ?? [],
  };

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
      <CheckoutStepper
        mpEnabled={await isMercadoPagoConfigured()}
        shipping={shipping}
      />
    </div>
  );
}
