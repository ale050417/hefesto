import { getUserEmail } from "@/core/supabase/admin";
import { findContactByName } from "@/features/customers/service";
import { listColorsForSale } from "@/features/inventory/queries";
import { effectiveAccent } from "@/features/settings/seasons";
import { getBusinessSettings } from "@/features/settings/service";
import { siteUrl } from "@/lib/site";
import {
  buildManualSaleReceipt,
  buildOrderReceipt,
  type Receipt,
  type ReceiptBusiness,
} from "../receipt";
import { findOrderDetailForAdmin } from "../repository";
import { getManualSale } from "./manualSaleService";

/**
 * Carga de datos del comprobante (página /comprobante). La autorización NO
 * vive acá: la resuelve la página (el staff ve todo; un cliente solo lo suyo,
 * comparando `receipt.ownerId` con su id).
 */

/** Comprobante de un pedido online, con el mail del cliente (best-effort). */
export async function getOrderReceipt(id: string): Promise<Receipt | null> {
  const order = await findOrderDetailForAdmin(id);
  if (!order) return null;
  // El mail vive en auth (no en profiles). Si la API admin no está configurada
  // o falla, el comprobante sale igual, sin mail: nunca bloquea.
  const email = await getUserEmail(order.customerId).catch(() => null);
  return buildOrderReceipt(order, { email });
}

/**
 * Comprobante de una venta manual. El contacto se busca por nombre (la venta
 * guarda al cliente como texto) y, en ventas simples, los colores salen del
 * stock que descontó. Las dos cosas son best-effort: sin ellas sale igual.
 */
export async function getManualSaleReceipt(
  id: string,
): Promise<Receipt | null> {
  const sale = await getManualSale(id);
  if (!sale) return null;
  const [contact, colors] = await Promise.all([
    findContactByName(sale.customerName).catch(() => null),
    sale.items.length > 0
      ? Promise.resolve<string[]>([])
      : listColorsForSale(sale.id).catch((): string[] => []),
  ]);
  return buildManualSaleReceipt(sale, { contact, colors });
}

/**
 * Datos del taller para el encabezado (Config → Negocio). Solo nombre y
 * slogan tienen default: el resto se muestra únicamente si está cargado, un
 * comprobante no puede llevar un teléfono o una dirección de relleno.
 */
export async function getReceiptBusiness(): Promise<ReceiptBusiness> {
  const s = await getBusinessSettings().catch(() => null);
  const clean = (v: string | null | undefined): string | null => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    name: clean(s?.storeName) ?? "Hefesto 3D",
    slogan: clean(s?.slogan) ?? "Forjado en capas",
    logoUrl: clean(s?.logoUrl),
    whatsapp: clean(s?.whatsapp),
    email: clean(s?.contactEmail),
    instagram: clean(s?.instagram),
    address: clean(s?.addressText),
    cuit: clean(s?.cuit),
    site: siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    // Mismo criterio que ThemeApplier: acento propio o el de la temporada.
    accent: effectiveAccent(s?.season ?? "none", s?.accentColor ?? null),
  };
}
