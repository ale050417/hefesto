"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import { ManualSaleForm } from "./manual-order-form";

export function CargarVentaButton({
  partners = [],
}: {
  partners?: Array<{ name: string; pct: number }>;
}) {
  const [open, setOpen] = useState(false);
  const canCreate = useCan("pedidos", "crear");
  if (!canCreate) return null;
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Cargar venta
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cargar venta manual"
        size="lg"
      >
        <ManualSaleForm
          partners={partners}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
