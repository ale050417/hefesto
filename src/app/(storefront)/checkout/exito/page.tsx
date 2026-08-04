import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/core/auth/session";
import { ClearCartOnMount } from "@/features/cart/components/clear-cart-on-mount";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { getOrderForCustomer } from "@/features/orders/services/orderQueries";
import { getBrandSettings } from "@/features/settings/service";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pedido recibido" };

/**
 * Link de WhatsApp con el pedido ya escrito en el mensaje. El efectivo (y la
 * transferencia) no se cobran online: la compra termina de verdad cuando el
 * cliente y el taller coordinan. Sin este paso, el cliente confirmaba y quedaba
 * en una pantalla de "gracias" sin saber qué hacer (pedido de Ale 2026-08-03).
 */
function waPedido(whatsapp: string | null, texto: string): string | null {
  if (!whatsapp) return null;
  const d = whatsapp.replace(/[^\d]/g, "");
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}` : null;
}

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
  const [order, brand] = await Promise.all([
    orderNumber && user ? getOrderForCustomer(orderNumber, user.id) : null,
    getBrandSettings(),
  ]);

  // Efectivo y transferencia se coordinan por WhatsApp: no hay cobro online.
  const aCoordinar =
    order?.paymentMethod === "cash" || order?.paymentMethod === "transfer";
  const esEfectivo = order?.paymentMethod === "cash";
  const wa = order
    ? waPedido(
        brand.whatsapp,
        `¡Hola Hefesto 3D! Acabo de hacer el pedido ${order.orderNumber} por ${formatPrice(Number(order.total))}. ` +
          (esEfectivo
            ? "Quiero coordinar el pago en efectivo y la entrega."
            : "Quiero coordinar la transferencia y la entrega."),
      )
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

      {/* Último paso REAL de la compra: coordinar por WhatsApp. Va ARRIBA del
          detalle porque es lo único que el cliente tiene que hacer ahora. */}
      {order && aCoordinar ? (
        <div className="border-accent/40 bg-accent/5 mt-8 rounded-xl border p-5 text-center">
          <h2 className="font-display text-fg text-xl">
            Coordiná tu pedido por WhatsApp
          </h2>
          <p className="text-dim mx-auto mt-2 max-w-md text-sm leading-relaxed">
            {esEfectivo
              ? "Elegiste pagar en efectivo, así que no hay nada que pagar online. Escribinos y arreglamos el pago y la entrega o el retiro."
              : "Te pasamos los datos para transferir y coordinamos la entrega."}
          </p>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                buttonVariants({ variant: "primary" }),
                "mt-4 inline-flex",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.09c-.25.69-1.43 1.32-1.97 1.37-.5.05-.97.23-3.27-.68-2.76-1.09-4.5-3.9-4.64-4.09-.13-.19-1.1-1.47-1.1-2.8s.7-1.98.94-2.25c.25-.27.54-.34.72-.34l.52.01c.17 0 .39-.06.61.47.22.53.76 1.86.83 2 .07.13.11.29.02.47-.09.19-.13.3-.27.46l-.4.47c-.13.13-.27.28-.12.54.15.27.66 1.09 1.42 1.77.98.87 1.8 1.14 2.06 1.27.26.13.41.11.56-.07.15-.18.64-.75.81-1.01.17-.26.34-.21.57-.13.23.09 1.47.69 1.72.82.25.13.42.19.48.3.06.1.06.6-.19 1.29Z" />
              </svg>
              Coordinar por WhatsApp
            </a>
          ) : (
            <p className="text-faint mt-3 text-xs">
              Cargá tu WhatsApp en Configuración → Negocio para que este botón
              aparezca.
            </p>
          )}
          <p className="text-faint mt-3 text-xs">
            Guardá el número de pedido:{" "}
            <span className="text-fg font-medium">{order.orderNumber}</span>
          </p>
        </div>
      ) : null}

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
