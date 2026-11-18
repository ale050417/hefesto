"use client";

import { useState } from "react";
import { WhatsappIcon } from "@/components/shared/whatsapp-icon";
import { siteUrl } from "@/lib/site";
import { productShareLink, productShareText, whatsappShareUrl } from "../share";

type Props = {
  name: string;
  slug: string;
  /** Precio ya formateado; va en el mensaje. */
  price?: string | null;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const LinkIcon = (
  <svg
    viewBox="0 0 24 24"
    width={15}
    height={15}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </svg>
);

/**
 * Compartir un producto (pedido de Antonella, 2026-11-18): WhatsApp con el
 * nombre, el precio y el link ya escritos, y "Copiar link" para pegarlo donde
 * haga falta. Es la fila que va en la página del producto de la tienda.
 */
export function ShareProduct({ name, slug, price }: Props) {
  const [copied, setCopied] = useState(false);
  const link = productShareLink(siteUrl, slug);
  const text = productShareText({ name, link, price });

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="text-faint">Compartir:</span>
      <a
        href={whatsappShareUrl(text)}
        target="_blank"
        rel="noreferrer noopener"
        className="text-dim hover:text-fg inline-flex items-center gap-1.5 transition-colors"
      >
        <WhatsappIcon size={16} />
        WhatsApp
      </a>
      <button
        type="button"
        className="text-dim hover:text-fg inline-flex items-center gap-1.5 transition-colors"
        onClick={async () => {
          if (!(await copyText(link))) return;
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
      >
        {LinkIcon}
        <span aria-live="polite">
          {copied ? "Link copiado" : "Copiar link"}
        </span>
      </button>
    </div>
  );
}

/** El mismo WhatsApp, como botón de ícono para las listas del panel. */
export function ShareProductIcon({
  name,
  slug,
  price,
  className,
  style,
}: Props & { className?: string; style?: React.CSSProperties }) {
  const link = productShareLink(siteUrl, slug);
  return (
    <a
      href={whatsappShareUrl(productShareText({ name, link, price }))}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      style={style}
      title="Compartir por WhatsApp"
      aria-label={`Compartir ${name} por WhatsApp`}
      onClick={(e) => e.stopPropagation()}
    >
      <WhatsappIcon size={15} />
    </a>
  );
}
