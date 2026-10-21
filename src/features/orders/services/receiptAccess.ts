import { cache } from "react";
import { can } from "@/core/auth/permissions";
import { getCurrentUser } from "@/core/auth/session";
import { isUuid } from "@/lib/ids";
import { loadOrThrow } from "@/lib/safe-load";
import {
  RECEIPT_KIND_BY_SEGMENT,
  type Receipt,
  type ReceiptBusiness,
} from "../receipt";
import {
  getManualSaleReceipt,
  getOrderReceipt,
  getReceiptBusiness,
} from "./receiptService";

export type ReceiptAccess =
  | { kind: "login"; to: string }
  | { kind: "notfound" }
  | { kind: "ok"; receipt: Receipt; business: ReceiptBusiness; staff: boolean };

/**
 * Quién puede ver el comprobante de /comprobante/[tipo]/[id], en la página y
 * en su PDF (misma regla en los dos lugares, por eso vive acá):
 *
 * - staff con permiso de ver pedidos: cualquiera;
 * - un cliente: solo SUS pedidos online (Cap. 13);
 * - ventas manuales: no tienen cliente con cuenta, así que solo el taller.
 *
 * Lo ajeno es un 404, no un 403: no se confirma que exista. Sin sesión se
 * manda al login con vuelta al comprobante. Cacheado por request (React
 * cache): la página y su título lo comparten sin repetir consultas.
 */
export const resolveReceipt = cache(
  async (tipo: string, id: string): Promise<ReceiptAccess> => {
    const kind = RECEIPT_KIND_BY_SEGMENT[tipo];
    if (!kind || !isUuid(id)) return { kind: "notfound" };

    const user = await getCurrentUser();
    if (!user) {
      const back = encodeURIComponent(`/comprobante/${tipo}/${id}`);
      return { kind: "login", to: `/ingresar?redirect=${back}` };
    }
    if (user.profileUnavailable) {
      throw new Error(
        "No pudimos verificar tu sesión: la base de datos no respondió. Recargá en unos segundos.",
      );
    }
    const staff = await can("pedidos", "ver");
    if (kind === "manual" && !staff) return { kind: "notfound" };

    const receipt = await loadOrThrow(
      "comprobante",
      kind === "online" ? getOrderReceipt(id) : getManualSaleReceipt(id),
    );
    if (!receipt) return { kind: "notfound" };
    if (!staff && receipt.ownerId !== user.id) return { kind: "notfound" };

    const business = await getReceiptBusiness();
    return { kind: "ok", receipt, business, staff };
  },
);
