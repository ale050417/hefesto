"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
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
 * Segunda vuelta del mismo día ("mejorá todo mil veces"):
 *  - La foto entra por arrastre, selector, cámara del celular (botón que
 *    abre la cámara directo) o PEGANDO con Ctrl+V (WhatsApp Web, capturas).
 *  - Cada generación se guarda en una tira de miniaturas: se comparan y se
 *    elige la mejor, en vez de descartar para probar otra.
 *  - Barra de progreso con segundos (el modelo tarda 10–35 s).
 *  - Tocar una foto la abre grande (lightbox) para revisar detalles.
 *  - "Descargar" (para redes) y, opcionalmente, "Agregar como foto extra".
 *  - Enter en la escena escrita genera.
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
type Shot = { url: string; file: File; scene: string; at: number };

const GEMINI_URL = "https://gemini.google.com/app";
/** Tiempo típico; la barra se frena en 92 % hasta que llega la respuesta. */
const EXPECTED_MS = 18_000;

/** Escenas rápidas. El valor va al prompt tal cual (en inglés rinde mejor). */
const SCENE_PRESETS: Array<{ label: string; value: string; hint: string }> = [
  {
    label: "Automática",
    value: "",
    hint: "Según el tipo de pieza: un vaso en una barra, una maceta entre plantas…",
  },
  {
    label: "🎬 Estudio",
    value: "on a dark studio table with no props, clean and minimal",
    hint: "Solo la pieza sobre fondo oscuro, sin objetos alrededor.",
  },
  {
    label: "🍸 Bar",
    value: "on a wooden bar counter with warm lights",
    hint: "Barra de madera y luces cálidas de fondo.",
  },
  {
    label: "🌿 Plantas",
    value: "on a bright shelf next to green plants",
    hint: "Estante claro con plantas verdes.",
  },
  {
    label: "💻 Escritorio",
    value: "on a modern desk with soft RGB lights",
    hint: "Escritorio gamer con luces RGB suaves.",
  },
  {
    label: "🛋️ Living",
    value: "on a living-room shelf with tasteful decor",
    hint: "Repisa de living con decoración.",
  },
  {
    label: "🏆 Podio",
    value: "on a podium under a single spotlight",
    hint: "Podio con un foco, clima de premiación.",
  },
  {
    label: "🎄 Navidad",
    value: "with warm Christmas lights in the background",
    hint: "Luces navideñas desenfocadas de fondo.",
  },
  {
    label: "🎃 Halloween",
    value: "on a dark table with candles and mist",
    hint: "Mesa oscura, velas y niebla.",
  },
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
  onUseExtra,
  useLabel = "Usar esta foto",
  extraLabel = "Agregar como foto extra",
  fallbackSource = null,
  fallbackLabel = "Usar la imagen principal como base",
  disabled = false,
  className,
}: {
  context: AiImageContext;
  /** Qué hacer con la generada cuando el usuario la acepta (y con qué foto se hizo). */
  onUse: (file: File, source: File) => void | Promise<void>;
  /** Acción secundaria (ej. sumarla como foto extra). Sin esto no se muestra. */
  onUseExtra?: ((file: File) => void | Promise<void>) | null;
  useLabel?: string;
  extraLabel?: string;
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
  const [elapsed, setElapsed] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const [used, setUsed] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // El lightbox va en un portal: dentro del modal de edición (que tiene
  // transform) un `position: fixed` quedaría encerrado en la tarjeta.
  const mounted = useMounted();

  // Object URLs vivos, para liberarlos al desmontar / reemplazar.
  const sourceUrl = useRef<string | null>(null);
  const shotUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
      shotUrls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  // Cronómetro mientras genera.
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = window.setInterval(
      () => setElapsed(Math.round((Date.now() - t0) / 1000)),
      500,
    );
    return () => window.clearInterval(id);
  }, [busy]);

  // Escape cierra el lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const pickSource = useCallback((file: File | null) => {
    if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current);
    const url = file ? URL.createObjectURL(file) : null;
    sourceUrl.current = url;
    setSource(file && url ? { file, url } : null);
    setError(null);
    setUsed(null);
  }, []);

  function clearShots() {
    shotUrls.current.forEach((u) => URL.revokeObjectURL(u));
    shotUrls.current = [];
    setShots([]);
    setSelected(0);
    setUsed(null);
  }

  // Pegar una imagen (Ctrl+V) en cualquier parte de la tarjeta.
  function onPaste(e: ClipboardEvent<HTMLElement>) {
    if (disabled || busy) return;
    const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
      /^image\/(jpeg|png|webp)$/.test(i.type),
    );
    const file = item?.getAsFile();
    if (!file) return;
    e.preventDefault();
    const named = new File(
      [file],
      `pegada-${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`,
      {
        type: file.type,
      },
    );
    pickSource(named);
  }

  const sceneLabel = custom.trim()
    ? custom.trim()
    : (SCENE_PRESETS[preset]?.label ?? "Automática");
  const scene = custom.trim() || SCENE_PRESETS[preset]?.value || "";
  const result = shots[selected] ?? null;

  async function generate() {
    if (!source || busy || disabled) return;
    if (context.name.trim().length < 2) {
      setError({
        code: "invalid",
        message: "Escribí primero el nombre del producto (paso Básicos).",
      });
      return;
    }
    setElapsed(0);
    setBusy(true);
    setError(null);
    setCopied(false);
    setUsed(null);
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
      const n = shots.length + 1;
      const file = new File(
        [blob],
        `${slugOf(context.name)}-ia${n > 1 ? `-${n}` : ""}.${ext}`,
        { type: blob.type },
      );
      const url = URL.createObjectURL(blob);
      shotUrls.current.push(url);
      setShots((prev) => {
        const next = [
          ...prev,
          { url, file, scene: sceneLabel, at: Date.now() },
        ];
        setSelected(next.length - 1);
        return next;
      });
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
  const progress = busy
    ? Math.min(92, Math.round(((elapsed * 1000) / EXPECTED_MS) * 100))
    : 0;

  return (
    <section
      className={cn("ai-card", className)}
      aria-label="Foto de producto con IA"
      onPaste={onPaste}
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
          <span className="ai-card-badge">Gratis · ~20 s</span>
        </div>
        <p className="text-faint text-[12px] leading-snug">
          Sacale una foto a la pieza con el celular y te la devuelve como foto
          de catálogo: la misma pieza, luz de estudio y una escena acorde.
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
            title="Arrastrá, pegá o sacá una foto"
            hint="Sirve cualquier fondo. También podés pegarla con Ctrl+V."
            cta="Elegir foto"
            cameraCta="Sacar foto"
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
                title={p.hint}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
          />
          <p className="text-faint text-[11.5px] leading-snug">
            {custom.trim()
              ? "Se usa tu descripción tal cual. Enter genera."
              : SCENE_PRESETS[preset]?.hint}
          </p>
        </div>
      </div>

      {/* 3. Resultado: tu foto → catálogo */}
      <div className="ai-step">
        <span className="ai-step-n">3</span> Resultado
        {shots.length > 1 ? (
          <span className="text-faint font-normal">
            · {selected + 1} de {shots.length}
          </span>
        ) : null}
      </div>
      <div className="ai-stage">
        <figure className="ai-slot">
          {source ? (
            <button
              type="button"
              className="ai-slot-img"
              title="Ver grande"
              onClick={() => setLightbox(source.url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={source.url} alt="Tu foto" />
            </button>
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
          {busy ? (
            <span className="ai-slot-empty">
              <Spinner size={18} /> Generando… {elapsed} s
              <span className="ai-progress" aria-hidden>
                <span style={{ width: `${progress}%` }} />
              </span>
            </span>
          ) : result ? (
            <button
              type="button"
              className="ai-slot-img"
              title="Ver grande"
              onClick={() => setLightbox(result.url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.url} alt="Foto de catálogo generada" />
            </button>
          ) : (
            <span className="ai-slot-empty">Foto de catálogo</span>
          )}
          <figcaption>{result && !busy ? result.scene : "Catálogo"}</figcaption>
        </figure>
      </div>

      {/* Tira de generadas: se comparan y se elige la mejor. */}
      {shots.length > 1 ? (
        <div className="ai-history" role="list" aria-label="Fotos generadas">
          {shots.map((s, i) => (
            <button
              key={s.url}
              type="button"
              role="listitem"
              className={cn("ai-history-item", i === selected && "active")}
              title={s.scene}
              disabled={busy}
              onClick={() => {
                setSelected(i);
                setUsed(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={`Generada ${i + 1}`} />
            </button>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm self-center"
            disabled={busy}
            onClick={clearShots}
          >
            Limpiar
          </button>
        </div>
      ) : null}

      {/* Acciones */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {result && !busy ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={off || used === result.url}
              onClick={async () => {
                if (!source) return;
                await onUse(result.file, source.file);
                setUsed(result.url);
              }}
            >
              {used === result.url ? "✓ Aplicada" : useLabel}
            </Button>
            {onUseExtra ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={off}
                onClick={() => onUseExtra(result.file)}
              >
                {extraLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={off}
              onClick={generate}
            >
              ✨ Generar otra
            </Button>
            <a
              className="btn btn-ghost btn-sm"
              href={result.url}
              download={result.file.name}
            >
              Descargar
            </a>
            {shots.length === 1 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={off}
                onClick={clearShots}
              >
                Descartar
              </Button>
            ) : null}
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
        {result && !busy && used !== result.url ? (
          <span className="text-faint text-[11.5px]">
            ¿No convence? Cambiá la escena y generá otra; las anteriores quedan
            guardadas para comparar.
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

      {/* Lightbox: la foto grande, cierra con click o Escape. */}
      {lightbox && mounted
        ? createPortal(
            <div
              className="ai-lightbox"
              data-portal=""
              role="dialog"
              aria-modal="true"
              aria-label="Foto grande"
              onClick={() => setLightbox(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox} alt="" />
              <button
                type="button"
                className="ai-lightbox-close"
                aria-label="Cerrar"
                onClick={() => setLightbox(null)}
              >
                ✕
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
