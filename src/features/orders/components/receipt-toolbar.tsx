"use client";

import Link from "next/link";

const PrinterIcon = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </svg>
);

const DownloadIcon = (
  <svg
    viewBox="0 0 24 24"
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

/**
 * Barra de acciones del comprobante abierto en su propia pestaña (no sale
 * impresa: ver `@media print`). "Descargar PDF" baja el archivo generado en
 * el servidor; "Imprimir" abre el diálogo de impresión del navegador.
 */
export function ReceiptToolbar({
  backHref,
  pdfHref,
}: {
  backHref: string;
  pdfHref: string;
}) {
  return (
    <div className="rcp-toolbar">
      <Link href={backHref} className="btn btn-ghost btn-sm">
        ← Volver
      </Link>
      <div className="rcp-toolbar-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => window.print()}
        >
          {PrinterIcon}
          Imprimir
        </button>
        <a href={pdfHref} download className="btn btn-primary btn-sm">
          {DownloadIcon}
          Descargar PDF
        </a>
      </div>
    </div>
  );
}
