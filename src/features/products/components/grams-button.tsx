"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

/**
 * Botón "Gramos" — único lugar para cargar el material (la calculadora es solo
 * para el precio). Abre un modal donde se cargan los gramos que usa la pieza,
 * para descontar el stock de filamento al vender (no cambia el precio).
 *
 * - `multi`: gramos de CADA color que lleva la pieza.
 * - `single`: un solo peso (los gramos de la pieza; se descuentan del color que
 *   elija el cliente).
 *
 * Se usa a nivel producto (sin tamaños) y por tamaño (con tamaños).
 */
type MultiProps = {
  mode: "multi";
  colors: string[];
  colorGrams: Record<string, number>;
  onColorGrams: (next: Record<string, number>) => void;
  hexOf?: (c: string) => string;
};
type SingleProps = {
  mode: "single";
  weight: number;
  onWeight: (grams: number) => void;
};

const dot = (bg: string) => ({
  width: 13,
  height: 13,
  borderRadius: "50%",
  background: bg,
  border: "1px solid var(--border)",
  flexShrink: 0,
});

export function GramsButton(props: MultiProps | SingleProps) {
  const [open, setOpen] = useState(false);
  const total =
    props.mode === "multi"
      ? props.colors.reduce((a, c) => a + (Number(props.colorGrams[c]) || 0), 0)
      : Number(props.weight) || 0;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(true)}
      >
        ⚖ Gramos{total > 0 ? ` · ${total} g` : ""}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Gramos de material"
      >
        <div className="flex flex-col gap-2">
          <p className="text-faint text-[12.5px] leading-relaxed">
            Cuántos gramos usa la pieza. Se descuentan del stock de filamento al
            vender; no cambia el precio.
          </p>
          {props.mode === "multi" ? (
            props.colors.length === 0 ? (
              <p className="text-faint text-[12.5px]">
                Elegí primero los colores de la pieza.
              </p>
            ) : (
              props.colors.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="flex w-36 items-center gap-2 text-sm">
                    {props.hexOf ? <span style={dot(props.hexOf(c))} /> : null}
                    {c}
                  </span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    placeholder="0"
                    value={props.colorGrams[c] || ""}
                    onChange={(e) =>
                      props.onColorGrams({
                        ...props.colorGrams,
                        [c]: Number(e.target.value) || 0,
                      })
                    }
                  />
                  <span className="text-faint text-xs">g</span>
                </div>
              ))
            )
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-36 text-sm">Gramos de la pieza</span>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="0"
                value={props.weight || ""}
                onChange={(e) => props.onWeight(Number(e.target.value) || 0)}
              />
              <span className="text-faint text-xs">g</span>
            </div>
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
