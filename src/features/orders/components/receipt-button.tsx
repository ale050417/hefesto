"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { receiptPath, type ReceiptKind } from "../receipt";

const ReceiptIcon = (
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
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M14 8H8M16 12H8M13 16H8" />
  </svg>
);

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
 * Botón "Comprobante" de una venta (2026-10-20, pedido de Ale: "que abra un
 * modal y ahí elija si quiere descargar o imprimir"). Abre un modal con la
 * vista previa del comprobante (la misma página, embebida) y dos acciones:
 *
 * - "Descargar PDF": baja el archivo generado en el servidor (…/pdf), listo
 *   para mandar por WhatsApp o mail.
 * - "Imprimir": abre el diálogo de impresión SOLO del comprobante (imprime el
 *   iframe de la vista previa, no el panel).
 *
 * `icon` para la tabla y las tarjetas del tablero; `button` para las páginas
 * de detalle (panel y Mi cuenta).
 */
export function ReceiptButton({
  kind,
  id,
  code,
  customerName,
  total,
  variant = "icon",
  className,
}: {
  kind: ReceiptKind;
  id: string;
  /** Número que ve el cliente (HEF-0042 / VM-XXXXXXXX), para el título. */
  code: string;
  customerName?: string | null;
  total?: number | null;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const href = receiptPath(kind, id);

  const close = () => {
    setOpen(false);
    setReady(false);
  };
  const print = () => frame.current?.contentWindow?.print();

  const summary = [customerName, total != null ? formatPrice(total) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          className={cn("btn-icon btn-ghost", className)}
          title="Comprobante"
          aria-label={`Comprobante ${code}`}
          onClick={() => setOpen(true)}
        >
          {ReceiptIcon}
        </button>
      ) : (
        <button
          type="button"
          className={cn("btn btn-secondary btn-sm", className)}
          onClick={() => setOpen(true)}
        >
          {ReceiptIcon}
          Comprobante
        </button>
      )}

      <Modal
        open={open}
        onClose={close}
        size="lg"
        title={`Comprobante ${code}`}
        footer={
          <div className="rcp-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={print}
              disabled={!ready}
            >
              {PrinterIcon}
              Imprimir
            </button>
            <a href={`${href}/pdf`} download className="btn btn-primary">
              {DownloadIcon}
              Descargar PDF
            </a>
          </div>
        }
      >
        {summary ? <p className="rcp-modal-sub">{summary}</p> : null}
        <div className="rcp-preview">
          {!ready ? (
            <div className="rcp-preview-loading">
              <Spinner size={22} />
              Preparando la vista previa…
            </div>
          ) : null}
          {/* La vista previa es el comprobante real (misma página, embebida):
              lo que se ve es exactamente lo que se imprime o se descarga. */}
          <iframe
            ref={frame}
            title={`Vista previa del comprobante ${code}`}
            src={`${href}?embed=1`}
            onLoad={() => setReady(true)}
          />
        </div>
      </Modal>
    </>
  );
}
