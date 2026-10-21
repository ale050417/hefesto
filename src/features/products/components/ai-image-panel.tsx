"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { resizeImageToPng } from "@/lib/image-compress";

/**
 * "Foto de producto con IA" (pedido de Ale, 2026-10-21): el empleado saca
 * una foto de la pieza con el celular y acá se convierte en una foto de
 * catálogo (misma pieza, fondo de estudio, escena acorde). Antes tenía que
 * generarla por afuera y por eso dejó de cargar productos.
 *
 * Vive en el alta (paso Imágenes, sobre la imagen principal elegida) y en la
 * edición (bloque propio con su selector de foto). Llama al endpoint
 * /api/admin/products/ai-image; si Cloudflare rechaza la pieza (personajes
 * con derechos) o se agotó la cuota del día, deja el prompt listo para
 * copiar y un botón para abrir Gemini, que es gratis en la web.
 */

export type AiImageContext = {
  name: string;
  category: string | null;
  colors: string[];
  description: string | null;
};

type ApiError = { code: string; message: string; prompt?: string };

const GEMINI_URL = "https://gemini.google.com/app";

export function AiImagePanel({
  source,
  context,
  onUse,
  useLabel = "Usar esta foto",
}: {
  /** La foto de la pieza (del celular). Sin foto, el botón queda apagado. */
  source: File | null;
  context: AiImageContext;
  /** Qué hacer con la imagen generada cuando el usuario la acepta. */
  onUse: (file: File) => void | Promise<void>;
  useLabel?: string;
}) {
  const [scene, setScene] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; file: File } | null>(
    null,
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const resultUrl = useRef<string | null>(null);

  // Al cambiar la foto de origen, lo generado antes ya no corresponde
  // (patrón "estado derivado de una prop" de React, sin efecto).
  const [prevSource, setPrevSource] = useState(source);
  if (prevSource !== source) {
    setPrevSource(source);
    setResult(null);
    setError(null);
  }

  useEffect(() => {
    resultUrl.current = result?.url ?? null;
  }, [result]);
  useEffect(
    () => () => {
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );

  function discard() {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setError(null);
  }

  async function generate() {
    if (!source || busy) return;
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
      const small = await resizeImageToPng(source, 500);
      const fd = new FormData();
      fd.set("image", small);
      fd.set("name", context.name.trim());
      if (context.category) fd.set("category", context.category);
      fd.set("colors", JSON.stringify(context.colors));
      if (context.description) fd.set("description", context.description);
      if (scene.trim()) fd.set("scene", scene.trim());

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
      const base =
        context.name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "producto";
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const file = new File([blob], `${base}-ia.${ext}`, { type: blob.type });
      if (result) URL.revokeObjectURL(result.url);
      setResult({ url: URL.createObjectURL(blob), file });
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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">✨ Foto de producto con IA</strong>
        <span className="text-faint text-[11.5px]">Gratis · tarda ~10 s</span>
      </div>
      <p className="text-faint text-[11.5px] leading-relaxed">
        Toma la foto de la pieza y la convierte en una foto de catálogo: la
        misma pieza, fondo oscuro de estudio y una escena acorde (un vaso en una
        barra, una figura en su mundo, una maceta entre plantas).
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="input min-w-0 flex-1"
          placeholder="Escena (opcional): ej. en la barra de un bar"
          value={scene}
          maxLength={200}
          disabled={busy}
          onChange={(e) => setScene(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={!source || busy}
          onClick={generate}
        >
          {busy ? (
            <>
              <Spinner size={14} /> Generando…
            </>
          ) : result ? (
            "Generar otra"
          ) : (
            "Generar"
          )}
        </Button>
      </div>
      {!source ? (
        <p className="text-faint text-[11.5px]">
          Primero elegí la foto de la pieza.
        </p>
      ) : null}

      {error ? (
        <div className="bg-warning/10 text-warning flex flex-col gap-2 rounded-md px-3 py-2 text-[12.5px] leading-relaxed">
          <p>{error.message}</p>
          {error.prompt ? (
            <div className="flex flex-wrap gap-2">
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
              <span className="text-faint self-center text-[11.5px]">
                En Gemini: pegá el prompt, adjuntá la foto, bajá la imagen y
                subila acá.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div className="flex flex-wrap items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.url}
            alt="Foto generada"
            className="h-40 w-40 rounded-md object-cover"
          />
          <div className="flex flex-col gap-2">
            <Button type="button" size="sm" onClick={() => onUse(result.file)}>
              {useLabel}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={discard}>
              Descartar
            </Button>
            <span className="text-faint text-[11.5px]">
              ¿No convence? Cambiá la escena y generá otra.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
