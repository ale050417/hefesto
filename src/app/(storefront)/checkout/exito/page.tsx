import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/core/auth/session";
import { ClearCartOnMount } from "@/features/cart/components/clear-cart-on-mount";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { getOrderForCustomer } from "@/features/orders/services/orderQueries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pedido recibido" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CheckoutExitoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.pedido) ? sp.pedido[0] : sp.pedido;
  const orderNumber = typeof raw === "string" ? raw : null;

  const user = await getCurrentUser();
  const order =
    orderNumber && user
      ? await getOrderForCustomer(orderNumber, user.id)
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-fg text-3xl">
          ¡Gracias por tu compra!
        </h1>
        <p className="text-dim mt-3">
          {order
            ? "Recibimos tu pedido. Te mostramos el detalle abajo."
            : "Recibimos tu pedido."}
        </p>
      </div>

      {order ? (
        <div className="mt-8">
          <ClearCartOnMount />
          <OrderSummary order={order} />
        </div>
      ) : orderNumber ? (
        <p className="bg-surface-1 border-surface-2 text-dim mx-auto mt-8 max-w-md rounded-lg border px-4 py-3 text-center text-sm">
          No pudimos mostrar el detalle del pedido{" "}
          <span className="text-fg font-medium">{orderNumber}</span>. Si es
          tuyo, asegurate de haber iniciado sesión.
        </p>
      ) : null}

      <div className="mt-10 text-center">
        <Link
          href="/catalogo"
          className={cn(buttonVariants({ variant: "primary" }))}
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
