"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import { FailureForm, type FailureFilament } from "./failure-form";

export function RegistrarFallaButton({
  materials,
  filaments,
}: {
  materials: string[];
  filaments: FailureFilament[];
}) {
  const [open, setOpen] = useState(false);
  const canCreate = useCan("fallas", "crear");
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
        Registrar falla
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nueva impresión fallida"
        size="lg"
      >
        <FailureForm
          materials={materials}
          filaments={filaments}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
