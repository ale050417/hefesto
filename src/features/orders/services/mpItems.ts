/**
 * Qué se le manda a MercadoPago para cobrar un pedido.
 *
 * REGLA: lo que MercadoPago le cobra al cliente tiene que ser EXACTAMENTE el
 * total del pedido. Ni un peso más, ni uno menos.
 *
 * Hasta el 2026-08-03 la preferencia se armaba solo con los productos, así que
 * MercadoPago ignoraba el envío y el cupón:
 *   - pedido con envío de $1.000 → el cliente pagaba $1.000 DE MENOS (pérdida);
 *   - pedido con cupón → el cliente pagaba el descuento DE MÁS (reclamo).
 * Se detectó comparando la pantalla de MercadoPago ($47.400) con el pedido
 * ($48.400) en una compra de prueba real.
 *
 * Cómo se resuelve, según el caso:
 *   - Sin descuento → una línea por producto (el cliente ve el detalle lindo en
 *     MercadoPago) + el envío como línea aparte.
 *   - Con descuento → UNA sola línea con el neto de la mercadería. Prorratear
 *     el descuento entre las líneas daría diferencias de centavos según cómo
 *     redondee cada una, y acá los centavos son plata: se prefiere una línea
 *     exacta antes que un detalle bonito que no cierra. El desglose completo
 *     el cliente lo tiene en la tienda y en el mail del pedido.
 *
 * Función PURA: entra el pedido, salen las líneas. Por eso se puede testear
 * sin tocar la red ni la base.
 */

export type MpItem = { title: string; quantity: number; unitPrice: number };

export type MpItemsInput = {
  orderNumber: string;
  items: Array<{ title: string; quantity: number; unitPrice: number }>;
  /** Descuento del cupón, en pesos. */
  discountAmount: number;
  /** Envío cobrado, en pesos. 0 = retiro o envío a coordinar. */
  shippingCost: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function buildMpItems(input: MpItemsInput): MpItem[] {
  const subtotal = round2(
    input.items.reduce((a, it) => a + it.unitPrice * it.quantity, 0),
  );
  const descuento = Math.max(0, round2(input.discountAmount));
  const envio = Math.max(0, round2(input.shippingCost));

  const out: MpItem[] =
    descuento > 0
      ? [
          {
            title: `Pedido ${input.orderNumber} (${input.items.length} producto${
              input.items.length === 1 ? "" : "s"
            }, descuento aplicado)`,
            quantity: 1,
            unitPrice: Math.max(0, round2(subtotal - descuento)),
          },
        ]
      : input.items.map((it) => ({
          title: it.title,
          quantity: it.quantity,
          unitPrice: round2(it.unitPrice),
        }));

  // El envío va como una línea más y no dentro del precio de un producto: así
  // el cliente ve en MercadoPago lo mismo que vio al confirmar.
  if (envio > 0) {
    out.push({ title: "Envío", quantity: 1, unitPrice: envio });
  }
  return out;
}

/** Lo que MercadoPago va a cobrar con esas líneas (para verificarlo). */
export function totalDeItems(items: MpItem[]): number {
  return round2(items.reduce((a, it) => a + it.unitPrice * it.quantity, 0));
}
