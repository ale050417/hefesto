"use client";

import { useState, type ComponentProps } from "react";
import type { ProductDraft } from "../product-drafts";
import { ProductDraftsButton } from "./product-drafts-button";
import { ProductWizard } from "./product-wizard";

/**
 * El asistente de "Nuevo producto" de la página, con sus borradores (pedido de
 * Agustín, 2026-11-22): si quedó algo a medio cargar, se retoma con
 * "Borradores" sin empezar de cero.
 */
export function NewProductWizard(
  props: Omit<ComponentProps<typeof ProductWizard>, "draft">,
) {
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ProductDraftsButton
          categories={props.categories}
          onResume={setDraft}
        />
      </div>
      {/* key: retomar un borrador arma el asistente de nuevo con sus datos. */}
      <ProductWizard key={draft?.id ?? "nuevo"} {...props} draft={draft} />
    </div>
  );
}
