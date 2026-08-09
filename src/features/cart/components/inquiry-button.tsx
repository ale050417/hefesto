"use client";

import { selectInquiryCount, useInquiryStore } from "@/stores/inquiryStore";
import { useUiStore } from "@/stores/uiStore";
import { useMounted } from "@/hooks/use-mounted";

/** El "carrito" de la vidriera digital: abre la lista de consulta. */
export function InquiryButton() {
  const count = useInquiryStore(selectInquiryCount);
  const openInquiry = useUiStore((s) => s.openInquiry);
  const mounted = useMounted();

  return (
    <button
      type="button"
      onClick={openInquiry}
      className="icon-btn"
      aria-label={`Abrir lista de consulta${mounted && count > 0 ? ` (${count})` : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="17"
        height="17"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4 8.5 8.5 0 0 1-7.6 4.6 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.6-7.6A8.38 8.38 0 0 1 12.9 3h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {mounted && count > 0 ? <span className="ic-badge">{count}</span> : null}
    </button>
  );
}
