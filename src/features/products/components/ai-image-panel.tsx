"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { resizeImageToPng } from "@/lib/image-compress";
import { PhotoPicker } from "./photo-picker";

/**
 * "Foto de producto con IA" (pedido de Ale, 2026-10-21): el empleado saca
 * una foto de la pieza con el celular y acá se convierte en una foto de
 * catálogo (misma pieza, fondo de estudio, escena acorde). Antes tenía que
 * generarla por afuera y por eso dejó de cargar productos.
 *
 * Rediseño del mismo día ("mejorá la vista 1000 veces"): la tarjeta es
 * autónoma y está SIEMPRE visible en el paso Imágenes del alta y en la
 * edición. Tiene su propio selector de foto (arrastrar / elegir / cámara),
 * escenas rápidas en chips, y una comparación "tu foto → catálogo". Si el
 * usuario ya eligió la imagen principal a mano, puede usarla como base
 * (`fallbackSource`).
 *
 * Llama al endpoint /api/admin/products/ai-image; si Cloudflare rechaza la
 * pieza (personajes con derechos) o se agotó la cuota del día, deja el
 * prompt listo para copiar y un botón para abrir Gemini, que es gratis.
 */

export type AiImageContext = {
  name: string;
  category: string | null;
  colors: string[];
  description: string | null;
};

type ApiError = { code: string; message: string; prompt?: string };

const GEMINI_URL = "https://gemini.google.com/app";

/** Escenas rápidas. El valor va al prompt tal cual (en inglés rinde mejor). */
const SCENE_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Automática", value: "" },
  { label: "🍸 Bar", value: "on a wooden bar counter with warm lights" },
  { label: "🌿 Plantas", value: "on a bright shelf next to green plants" },
  { label: "💻 Escritorio", value: "on a modern desk with soft RGB lights" },
  { label: "🛋️ Living", value: "on a living-room shelf with tasteful decor" },
  { label: "🏆 Podio", value: "on a podium under a single spotlight" },
  {
    label: "🎄 Navidad",
    value: "with warm Christmas lights in the background",
  },
  { label: "🎃 Halloween", value: "on a dark table with candles and mist" },
];

function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "producto"
  );
}

export function AiImagePanel({
  context,
  onUse,
  useLabel = "Usar esta foto",
  fallbackSource = null,
  fallbackLabel = "Usar la imagen principal como base",
  disabled = false,
  className,
}: {
  context: AiImageContext;
  /** Qué hacer con la generada cuando el usuario la acepta (y con qué foto se hizo). */
  onUse: (file: File, source: File) => void | Promise<void>;
  useLabel?: string;
  /** Foto ya elegida en otro lado (la principal) que se ofrece como base. */
  fallbackSource?: File | null;
  fallbackLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [source, setSource] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; file: File } | null>(
    null,
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);

  // Object URLs vivos, para liberarlos al desmontar.
  const urls = useRef<{ source: string | null; result: string | null }>({
    source: null,
    result: null,
  });
  useEffect(
    () => () => {
      if (urls.current.source) URL.revokeObjectURL(urls.current.source);
      if (urls.current.result) URL.revokeObjectURL(urls.current.result);
    },
    [],
  );

  function setResultSafe(next: { url: string; file: File } | null) {
    if (urls.current.result) URL.revokeObjectURL(urls.current.result);
    urls.current.result = next?.url ?? null;
    setResult(next);
  }

  function pickSource(file: File | null) {
    if (urls.current.source) URL.revokeObjectURL(urls.current.source);
    const url = file ? URL.createObjectURL(file) : null;
    urls.current.source = url;
    setSource(file && url ? { file, url } : null);
    // Lo generado antes ya no corresponde a esta foto.
    setResultSafe(null);
    setError(null);
  }

  const scene = custom.trim() || SCENE_PRESETS[preset]?.value || "";

  async function generate() {
    if (!source || busy || disabled) return;
    if (context.name.trim().length < 2) {
      setError({
        code: "invalid",
        message: "Escribí primero el nombre del producto (paso Básicos).",
      });
      return;
    }
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      // El modelo exige referencias chicas (< 512 px): se achica acá, así el
      // pedido pesa poco y no depende de sharp en el servidor.
      const small = await resizeImageToPng(source.file, 500);
      const fd = new FormData();
      fd.set("image", small);
      fd.set("name", context.name.trim());
      if (context.category) fd.set("category", context.category);
      fd.set("colors", JSON.stringify(context.colors));
      if (context.description) fd.set("description", context.description);
      if (scene) fd.set("scene", scene);

      const res = await fetch("/api/admin/products/ai-image", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; image: string; prompt: string }
        | ({ ok: false } & ApiError)
        | null;
      if (!data) {
        setError({
          code: "error",
          message: "No se pudo generar la imagen. Probá de nuevo.",
        });
        return;
      }
      if (!data.ok) {
        setError(data);
        return;
      }
      const blob = await (await fetch(data.image)).blob();
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `${slugOf(context.name)}-ia.${ext}`, {
        type: blob.type,
      });
      setResultSafe({ url: URL.createObjectURL(blob), file });
    } catch {
      setError({
        code: "error",
        message: "No se pudo generar la imagen. Probá de nuevo.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    if (!error?.prompt) return;
    try {
      await navigator.clipboard.writeText(error.prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const off = disabled || busy;

  return (
    <section
      className={cn("ai-card", className)}
      aria-label="Foto de producto con IA"
    >
      {/* Cabecera */}
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="ai-card-ic" aria-hidden>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6-5.6-1.9 5.6-1.9zM5 15l.9 2.6 2.6.9-2.6.9L5 22l-.9-2.6-2.6-.9 2.6-.9zM19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1 text-[15px] font-semibold">
            Foto de producto con IA
          </div>
          <span className="ai-card-badge">Gratis · ~10 s</span>
        </div>
        <p className="text-faint text-[12px] leading-snug">
          Subí la foto de la pieza y te la devuelve como foto de catálogo: la
          misma pieza, fondo de estudio y una escena acorde.
        </p>
      </header>

      <div className="ai-card-grid">
        {/* 1. La foto de la pieza */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="ai-step">
            <span className="ai-step-n">1</span> Tu foto de la pieza
          </div>
          <PhotoPicker
            previewUrl={source?.url}
            fileName={source?.file.name}
            disabled={off}
            title="Arrastrá o sacá una foto"
            hint="Con el celular, la cámara aparece al tocar. Sirve cualquier fondo."
            cta="Elegir o sacar foto"
            onPick={(files) => pickSource(files[0] ?? null)}
            onClear={() => pickSource(null)}
          />
          {!source && fallbackSource ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm self-start"
              disabled={off}
              onClick={() => pickSource(fallbackSource)}
            >
              {fallbackLabel}
            </button>
          ) : null}
        </div>

        {/* 2. La escena */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="ai-step">
            <span className="ai-step-n">2</span> Escena{" "}
            <span className="text-faint font-normal">(opcional)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCENE_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={cn(
                  "ai-chip",
                  i === preset && !custom.trim() && "active",
                )}
                disabled={off}
                onClick={() => {
                  setPreset(i);
                  setCustom("");
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ padding: "9px 12px", fontSize: 13 }}
            placeholder="O escribila: ej. en la barra de un bar"
            value={custom}
            maxLength={200}
            disabled={off}
            onChange={(e) => setCustom(e.target.value)}
          />
          <p className="text-faint text-[11.5px] leading-snug">
            Sin elegir nada, la escena sale del tipo de pieza: un vaso en una
            barra, una figura en su mundo, una maceta entre plantas.
          </p>
        </div>
      </div>

      {/* 3. Resultado: tu foto → catálogo */}
      <div className="ai-step">
        <span className="ai-step-n">3</span> Resultado
      </div>
      <div className="ai-stage">
        <figure className="ai-slot">
          {source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.url} alt="Tu foto" />
          ) : (
            <span className="ai-slot-empty">Tu foto</span>
          )}
          <figcaption>Tu foto</figcaption>
        </figure>
        <span className="ai-arrow" aria-hidden>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
        <figure className={cn("ai-slot is-result", busy && "is-busy")}>
          {result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.url} alt="Foto de catálogo generada" />
          ) : busy ? (
            <span className="ai-slot-empty">
              <Spinner size={18} /> Generando…
            </span>
          ) : (
            <span className="ai-slot-empty">Foto de catálogo</span>
          )}
          <figcaption>Catálogo</figcaption>
        </figure>
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {result ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={off}
              onClick={() => source && onUse(result.file, source.file)}
            >
              {useLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={off}
              onClick={generate}
            >
              Generar otra
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={off}
              onClick={() => setResultSafe(null)}
            >
              Descartar
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!source || off}
            onClick={generate}
          >
            {busy ? (
              <>
                <Spinner size={14} /> Generando…
              </>
            ) : (
              "✨ Generar foto de catálogo"
            )}
          </Button>
        )}
        {!source && !busy ? (
          <span className="text-faint text-[11.5px]">
            Primero elegí la foto de la pieza.
          </span>
        ) : null}
        {result ? (
          <span className="text-faint text-[11.5px]">
            ¿No convence? Cambiá la escena y generá otra.
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="bg-warning/10 text-warning flex flex-col gap-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed">
          <p>{error.message}</p>
          {error.prompt ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={copyPrompt}
              >
                {copied ? "Prompt copiado ✓" : "Copiar prompt"}
              </Button>
              <a
                className="btn btn-secondary btn-sm"
                href={GEMINI_URL}
                target="_blank"
                rel="noreferrer"
              >
                Abrir Gemini
              </a>
              <span className="text-faint text-[11.5px]">
                En Gemini: pegá el prompt, adjuntá la foto, bajá la imagen y
                subila acá.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
