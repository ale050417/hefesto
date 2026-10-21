"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tablero de fotos del producto (alta): la PORTADA grande y hasta 4 fotos más
 * como mosaico, estilo Mercado Libre / Shopify. Antes eran dos zonas de
 * arrastre apiladas y una tira de miniaturas sueltas (pedido de Ale,
 * 2026-10-21: "mejorá la vista 1000 veces").
 *
 * - Casilleros vacíos = "+" para sumar; todo el tablero acepta arrastrar
 *   varias fotos de una (la primera va a portada si está vacía).
 * - Cada foto: ✕ para quitarla y "Hacer portada" en las extra (intercambia
 *   con la portada actual, no se pierde ninguna).
 * - `mainActions`: botones propios de la portada (auto-encuadre, volver a la
 *   original) que dibuja el padre debajo del tablero.
 */
export type MediaTile = { key: string; url: string; name?: string };

const ACCEPT = /^image\/(jpeg|png|webp)$/;

export function MediaBoard({
  main,
  extras,
  maxExtras = 4,
  disabled = false,
  mainRequired = true,
  mainBadge,
  onAdd,
  onRemoveMain,
  onRemoveExtra,
  onMakeMain,
  mainActions,
  className,
}: {
  main: MediaTile | null;
  extras: MediaTile[];
  maxExtras?: number;
  disabled?: boolean;
  mainRequired?: boolean;
  /** Etiqueta chica sobre la portada (ej. "Generada con IA"). */
  mainBadge?: string | null;
  /** Fotos nuevas, en orden: el padre decide portada / extras. */
  onAdd: (files: File[]) => void;
  onRemoveMain: () => void;
  onRemoveExtra: (key: string) => void;
  onMakeMain: (key: string) => void;
  mainActions?: ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const free = Math.max(0, maxExtras - extras.length) + (main ? 0 : 1);

  function take(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []).filter((f) => ACCEPT.test(f.type));
    if (files.length === 0) return;
    onAdd(files.slice(0, free));
  }

  const emptyExtras = Math.max(0, maxExtras - extras.length);

  return (
    <div className={cn("media-board-wrap flex flex-col gap-2", className)}>
      <div
        className={cn(
          "media-board",
          over && "is-over",
          disabled && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
      >
        {/* Portada */}
        {main ? (
          <figure className="media-tile is-main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={main.url} alt="" />
            <span className="media-badge">Portada</span>
            {mainBadge ? (
              <span className="media-badge is-secondary">{mainBadge}</span>
            ) : null}
            <div className="media-actions">
              <button
                type="button"
                className="media-act"
                onClick={() => inputRef.current?.click()}
              >
                Cambiar
              </button>
              <button
                type="button"
                className="media-act is-danger"
                aria-label="Quitar portada"
                onClick={onRemoveMain}
              >
                ✕
              </button>
            </div>
          </figure>
        ) : (
          <button
            type="button"
            className="media-tile is-main is-empty"
            onClick={() => inputRef.current?.click()}
          >
            <span className="media-plus" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h3l2-3h6l2 3h3v12H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            <span className="text-[13.5px] font-semibold">
              Portada{" "}
              {mainRequired ? (
                <span className="text-danger">*</span>
              ) : (
                <span className="text-faint font-normal">(opcional)</span>
              )}
            </span>
            <span className="text-faint text-[11.5px] leading-snug">
              Arrastrá o tocá para elegir. Cuadrada y de 1000 px o más queda
              mejor.
            </span>
          </button>
        )}

        {/* Extras */}
        {extras.map((t, i) => (
          <figure key={t.key} className="media-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.url} alt="" />
            <span className="media-badge is-dim">{i + 2}</span>
            <div className="media-actions">
              <button
                type="button"
                className="media-act"
                onClick={() => onMakeMain(t.key)}
              >
                Hacer portada
              </button>
              <button
                type="button"
                className="media-act is-danger"
                aria-label="Quitar foto"
                onClick={() => onRemoveExtra(t.key)}
              >
                ✕
              </button>
            </div>
          </figure>
        ))}
        {Array.from({ length: emptyExtras }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            className="media-tile is-empty"
            aria-label="Agregar foto"
            onClick={() => inputRef.current?.click()}
          >
            <span className="media-plus" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-faint text-[11px]">
              {i === 0 && extras.length === 0 ? "Más fotos" : ""}
            </span>
          </button>
        ))}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            take(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
      {mainActions ? (
        <div className="flex flex-wrap items-center gap-2">{mainActions}</div>
      ) : null}
    </div>
  );
}

/**
 * Foto por color / combinación: una casilla cuadrada por opción, con su
 * punto de color y nombre debajo. Vacía = "+", con foto = ✕ para sacarla.
 */
export function ColorPhotoRow({
  options,
  urls,
  hexOf,
  disabled = false,
  onPick,
  onRemove,
}: {
  options: string[];
  urls: Record<string, string | undefined>;
  /** Color del punto; `null` para no dibujarlo (combinaciones). */
  hexOf: ((name: string) => string) | null;
  disabled?: boolean;
  onPick: (option: string, file: File) => void;
  onRemove: (option: string) => void;
}) {
  return (
    <div className="color-photo-row">
      {options.map((opt) => (
        <ColorPhotoTile
          key={opt}
          label={opt}
          url={urls[opt]}
          hex={hexOf ? hexOf(opt) : null}
          disabled={disabled}
          onPick={(f) => onPick(opt, f)}
          onRemove={() => onRemove(opt)}
        />
      ))}
    </div>
  );
}

function ColorPhotoTile({
  label,
  url,
  hex,
  disabled,
  onPick,
  onRemove,
}: {
  label: string;
  url?: string;
  hex: string | null;
  disabled: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="color-photo">
      {url ? (
        <figure className="media-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} />
          <div className="media-actions">
            <button
              type="button"
              className="media-act"
              onClick={() => inputRef.current?.click()}
            >
              Cambiar
            </button>
            <button
              type="button"
              className="media-act is-danger"
              aria-label={`Quitar foto de ${label}`}
              onClick={onRemove}
            >
              ✕
            </button>
          </div>
        </figure>
      ) : (
        <button
          type="button"
          className="media-tile is-empty"
          disabled={disabled}
          aria-label={`Elegir foto de ${label}`}
          onClick={() => inputRef.current?.click()}
        >
          <span className="media-plus" aria-hidden>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </button>
      )}
      <div className="color-photo-label">
        {hex ? (
          <span
            className="shrink-0"
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: hex,
              border: "1px solid var(--border-strong)",
              display: "inline-block",
            }}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && ACCEPT.test(f.type)) onPick(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
