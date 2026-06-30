"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { PriceEstimator, type EstimatorValue } from "./price-estimator";
import type { EstimatorContext } from "../service";

/**
 * Calculadora de precio como herramienta FLOTANTE (modal), opcional: no estorba
 * el formulario. Calculás y con "Usar precio" se copia al campo. Mismo motor que
 * la calculadora (margen por tipo; el operador solo ve el precio).
 */
export function EstimatorModalButton({
  estimator,
  onUse,
  initial,
  label = "Calcular precio",
}: {
  estimator: EstimatorContext;
  onUse: (v: EstimatorValue) => void;
  initial?: Partial<{
    material: string;
    grams: number;
    printMinutes: number;
    layerHeight: string;
  }>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState<EstimatorValue | null>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
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
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M16 14h0M8 18h2M12 18h2M16 18h0" />
        </svg>
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Calculadora de precio"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <PriceEstimator {...estimator} initial={initial} onChange={setVal} />
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={!val || val.price == null}
              onClick={() => {
                if (val) {
                  onUse(val);
                  setOpen(false);
                }
              }}
            >
              {val?.price != null
                ? `Usar ${formatPrice(val.price)}`
                : "Usar precio"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
