"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Botón "Gramos" (al lado de Calcular, por tamaño). Abre un modal donde se
 * cargan los gramos de CADA color que usa ese tamaño — para descontar el stock
 * según el tamaño vendido, sin repartos automáticos. Solo se usa en multicolor.
 */
export function VariantGramsButton({
  colors,
  value,
  onChange,
  hexOf,
}: {
  colors: string[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  hexOf?: (c: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const total = colors.reduce((a, c) => a + (Number(value[c]) || 0), 0);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
      >
        Gramos{total > 0 ? ` · ${total} g` : ""}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Gramos por color de este tamaño"
      >
        <div className="flex flex-col gap-2">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Cargá los gramos de cada color que usa este tamaño. Se descuentan
            del stock al vender (no cambia el precio).
          </p>
          {colors.length === 0 ? (
            <p className="text-faint text-[12.5px]">
              Elegí primero los colores de la pieza.
            </p>
          ) : (
            colors.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="flex w-36 items-center gap-2 text-sm">
                  {hexOf ? (
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        background: hexOf(c),
                        border: "1px solid var(--border)",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  {c}
                </span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  placeholder="0"
                  value={value[c] || ""}
                  onChange={(e) =>
                    onChange({ ...value, [c]: Number(e.target.value) || 0 })
                  }
                />
                <span className="text-faint text-xs">g</span>
              </div>
            ))
          )}
          <div className="flex justify-end pt-1">
            <Button type="button" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
