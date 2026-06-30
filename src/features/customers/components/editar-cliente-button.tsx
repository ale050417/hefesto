"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useCan } from "@/components/auth/perms-provider";
import { CustomerForm, type ManualCustomerFormData } from "./customer-form";

export function EditarClienteButton({
  customer,
}: {
  customer: ManualCustomerFormData;
}) {
  const [open, setOpen] = useState(false);
  const canEdit = useCan("clientes", "editar");
  if (!canEdit) return null;
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        title="Editar cliente"
        aria-label="Editar cliente"
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
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Editar cliente"
        size="lg"
      >
        <CustomerForm
          customer={customer}
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
