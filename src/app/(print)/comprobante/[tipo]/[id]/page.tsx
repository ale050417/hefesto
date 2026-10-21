import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReceiptDocument } from "@/features/orders/components/receipt-document";
import { ReceiptToolbar } from "@/features/orders/components/receipt-toolbar";
import { receiptPath } from "@/features/orders/receipt";
import { resolveReceipt } from "@/features/orders/services/receiptAccess";

export const dynamic = "force-dynamic";

type Params = Promise<{ tipo: string; id: string }>;
type Search = Promise<{ embed?: string }>;

/**
 * Comprobante de una venta: /comprobante/pedido/[id] (online) y
 * /comprobante/venta/[id] (manual). Vive FUERA del panel (grupo "(print)")
 * para que la hoja salga sola, sin sidebar, al imprimir. Quién lo ve lo
 * decide `resolveReceipt` (misma regla que el PDF en ./pdf/route.ts).
 *
 * `?embed=1`: solo la hoja, sin barra ni fondo gris. Es lo que muestra el
 * iframe del modal "Comprobante" del panel como vista previa, y desde donde
 * se imprime.
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { tipo, id } = await params;
  const r = await resolveReceipt(tipo, id);
  return {
    title: r.kind === "ok" ? `Comprobante ${r.receipt.code}` : "Comprobante",
    robots: { index: false, follow: false },
  };
}

export default async function ComprobantePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ tipo, id }, { embed }] = await Promise.all([params, searchParams]);
  const r = await resolveReceipt(tipo, id);
  if (r.kind === "login") redirect(r.to);
  if (r.kind === "notfound") notFound();

  if (embed === "1") {
    return (
      <main className="rcp-page rcp-embed">
        <ReceiptDocument receipt={r.receipt} business={r.business} />
      </main>
    );
  }

  // "Volver" lleva a donde se abrió: al detalle del pedido o al tablero (staff),
  // o a "Mi pedido" (cliente).
  const backHref = r.staff
    ? r.receipt.kind === "online"
      ? `/admin/pedidos/${r.receipt.id}`
      : "/admin/pedidos"
    : `/cuenta/pedidos/${encodeURIComponent(r.receipt.code)}`;
  const pdfHref = `${receiptPath(r.receipt.kind, r.receipt.id)}/pdf`;

  return (
    <main className="rcp-page">
      <ReceiptToolbar backHref={backHref} pdfHref={pdfHref} />
      <ReceiptDocument receipt={r.receipt} business={r.business} />
    </main>
  );
}
