import {
  buildQuoteText,
  dimensionLines,
  parseColorList,
  type QuoteDefaults,
  type QuotePrice,
} from "@/features/quotes/build-quote";

/**
 * Mensaje para el cliente a partir de la respuesta del operador (pedido de
 * Ale, 2026-11-17: "que le arme solo un mensaje profesional"). Usa el MISMO
 * formato de cotización que ya manda Antonella (features/quotes), así una
 * consulta y una cotización suelta se leen igual. Puro: se testea.
 */
export type InquiryMessageInput = {
  title: string;
  quantity: number;
  unitPrice: number;
  bulkPrice?: number | null;
  bulkFrom?: number | null;
  dimensions?: string | null;
  colors?: string | null;
  deliveryTime?: string | null;
  note?: string | null;
};

export function buildInquiryMessage(
  input: InquiryMessageInput,
  defaults: QuoteDefaults,
): string {
  const qty = Math.max(1, Math.round(input.quantity));
  const prices: QuotePrice[] = [];
  if (qty > 1) {
    prices.push({
      label: "Precio (Por unidad)",
      amount: input.unitPrice,
      suffix: "c/u",
    });
    prices.push({
      label: `Total (${qty} unidades)`,
      amount: input.unitPrice * qty,
    });
  } else {
    prices.push({ label: "Precio", amount: input.unitPrice });
  }
  if (input.bulkPrice && input.bulkFrom) {
    prices.push({
      label: `Precio (A partir de ${input.bulkFrom} unidades)`,
      amount: input.bulkPrice,
      suffix: "c/u",
    });
  }

  const extra: string[] = [];
  const delivery = (input.deliveryTime ?? "").trim();
  if (delivery) extra.push(`⏱ DEMORA ESTIMADA: ${delivery}`);
  const note = (input.note ?? "").trim();
  if (note) extra.push(note);

  return buildQuoteText(
    {
      product: qty > 1 ? `${input.title} (x${qty})` : input.title,
      dimensions: dimensionLines(input.dimensions),
      prices,
      colors: parseColorList(input.colors),
      depositPct: defaults.depositPct,
      depositText: defaults.depositText,
      notes: defaults.notes,
      extra: extra.join("\n\n"),
    },
    defaults,
  );
}
