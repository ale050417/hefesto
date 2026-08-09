import { formatPrice } from "@/lib/format";
import type { InquiryItem } from "@/stores/inquiryStore";

/**
 * Arma UN mensaje de WhatsApp con toda la lista de consulta — el "PDF online"
 * que pidió Ale: el cliente arma su selección y acá se convierte en un solo
 * texto prolijo, listo para mandar (2026-08-09).
 */
export function buildInquiryMessage(items: InquiryItem[]): string {
  const lines = items.map((item) => {
    const extra = [item.variantLabel, item.color].filter(Boolean).join(" · ");
    const qtyPrefix = item.quantity > 1 ? `${item.quantity}x ` : "";
    const label = extra ? `${item.name} (${extra})` : item.name;
    return `• ${qtyPrefix}${label} — ${formatPrice(item.unitPrice * item.quantity)}`;
  });
  const total = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  return [
    "¡Hola! Quería consultar por estos productos:",
    "",
    ...lines,
    "",
    `Total aprox: ${formatPrice(total)}`,
  ].join("\n");
}
