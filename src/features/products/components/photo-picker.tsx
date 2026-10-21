"use client";

import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Selector de fotos del admin (pedido de Ale, 2026-10-21: "la vista se ve re
 * feo"). Reemplaza al `<input type="file">` nativo ("Seleccionar archivo ·
 * Ningún archivo seleccionado") en el alta y la edición de productos.
 *
 * - Zona punteada: arrastrar, tocar para elegir o, en el celular, sacar la
 *   foto con la cámara (`cameraCta` agrega un botón que abre la cámara
 *   directo; solo se ve en pantallas táctiles).
 * - Con foto elegida muestra la miniatura, el nombre y "Cambiar / Quitar".
 * - `multiple` para las fotos extra: no muestra miniatura (las dibuja el
 *   padre) y siempre queda listo para sumar más.
 * - `compact`: versión horizontal y baja para cuando va dentro de otra
 *   tarjeta (la de IA).
 */
export function PhotoPicker({
  previewUrl,
  fileName,
  onPick,
  onClear,
  multiple = false,
  disabled = false,
  title,
  hint,
  cta = "Elegir foto",
  cameraCta,
  compact = false,
  icon,
  className,
}: {
  /** Miniatura de la foto elegida (object URL o URL remota). */
  previewUrl?: string | null;
  fileName?: string | null;
  onPick: (files: File[]) => void;
  onClear?: () => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Texto principal de la zona vacía. */
  title?: ReactNode;
  /** Texto chico debajo del título. */
  hint?: ReactNode;
  cta?: string;
  /** Botón "Sacar foto" que abre la cámara (solo en pantallas táctiles). */
  cameraCta?: string;
  compact?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function take(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []).filter((f) =>
      /^image\/(jpeg|png|webp)$/.test(f.type),
    );
    if (files.length === 0) return;
    onPick(multiple ? files : files.slice(0, 1));
  }

  const inputs = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.currentTarget.value = "";
        }}
      />
      {cameraCta ? (
        // `capture` abre la cámara trasera directo en el teléfono (sin pasar
        // por la galería). En escritorio el navegador lo ignora.
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          className="hidden"
          onChange={(e) => {
            take(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      ) : null}
    </>
  );

  // Con foto elegida (modo simple): miniatura + acciones.
  if (!multiple && previewUrl) {
    return (
      <div
        className={cn(
          "photo-picked flex items-center gap-3 rounded-xl border border-[var(--border)] p-2.5",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">
            {fileName ?? "Foto elegida"}
          </div>
          {hint ? (
            <div className="text-faint mt-0.5 text-[11.5px] leading-snug">
              {hint}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Cambiar
          </button>
          {onClear ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={disabled}
              onClick={onClear}
            >
              Quitar
            </button>
          ) : null}
        </div>
        {inputs}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={cn(
        "photo-drop flex rounded-xl text-center",
        compact
          ? "photo-drop-compact items-center gap-3 px-3 py-3 text-left"
          : "flex-col items-center gap-2 px-4 py-5",
        dragOver && "is-over",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <span className="photo-drop-ic shrink-0" aria-hidden>
        {icon ?? (
          <svg
            width="22"
            height="22"
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
        )}
      </span>
      <div className={cn("min-w-0", compact && "flex-1")}>
        <div className="text-[13.5px] font-semibold">
          {title ?? (multiple ? "Arrastrá fotos acá" : "Arrastrá la foto acá")}
        </div>
        {hint ? (
          <div
            className={cn(
              "text-faint text-[11.5px] leading-snug",
              !compact && "mx-auto max-w-[34ch]",
            )}
          >
            {hint}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center justify-center gap-1.5",
          !compact && "mt-1",
        )}
      >
        <span className="btn btn-secondary btn-sm">{cta}</span>
        {cameraCta ? (
          <button
            type="button"
            className="btn btn-primary btn-sm only-touch"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              cameraRef.current?.click();
            }}
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
              <path d="M4 7h3l2-3h6l2 3h3v12H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {cameraCta}
          </button>
        ) : null}
      </div>
      {inputs}
    </div>
  );
}
