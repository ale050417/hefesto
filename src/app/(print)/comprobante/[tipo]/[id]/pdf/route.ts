import { NextResponse } from "next/server";
import { renderReceiptPdf } from "@/features/orders/pdf/receipt-pdf";
import { resolveReceipt } from "@/features/orders/services/receiptAccess";

export const dynamic = "force-dynamic";
// Generar el PDF (fuentes + logo + layout) tarda unos segundos en frío.
export const maxDuration = 30;

/**
 * El comprobante como archivo PDF: /comprobante/[tipo]/[id]/pdf. Es lo que
 * baja el botón "Descargar PDF" (modal del panel, barra del comprobante y
 * "Mi pedido"). Mismo permiso que la página (resolveReceipt). Con `?inline=1`
 * se muestra en el navegador en vez de descargarse.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo, id } = await params;
  const r = await resolveReceipt(tipo, id);
  if (r.kind === "login") {
    return NextResponse.redirect(new URL(r.to, request.url));
  }
  if (r.kind === "notfound") {
    return new Response("No encontramos el comprobante.", { status: 404 });
  }

  const pdf = await renderReceiptPdf(r.receipt, r.business);
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  // El código es ASCII (HEF-0042 / VM-XXXXXXXX): el nombre va sin codificar.
  const filename = `Comprobante ${r.receipt.code}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
