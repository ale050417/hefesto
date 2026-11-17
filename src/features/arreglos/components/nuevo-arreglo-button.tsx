"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import { FixForm } from "./fix-form";

export function NuevoArregloButton() {
  const [open, setOpen] = useState(false);
  const canCreate = useCan("arreglos", "crear");
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
        Nuevo arreglo
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo arreglo"
        size="lg"
      >
        {/* Se desmonta al cerrar: el próximo arranca vacío. */}
        <FixForm
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
