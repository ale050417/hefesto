"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { compressImageToWebp } from "@/lib/image-compress";
import { cn } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { getInquiryChatAction, sendInquiryMessageAction } from "../actions";
import type { ChatMessageView } from "../chat";
import { MAX_CHAT_BODY } from "../schemas";

/** Cada cuánto se piden los mensajes nuevos con el chat abierto. */
const POLL_MS = 4_000;

const timeFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayKey = (iso: string) => new Date(iso).toDateString();

/**
 * Chat en vivo de una consulta (pedido de Ale, 2026-11-25): la vendedora y el
 * operador conversan acá, con texto y fotos, hasta dejar todo definido. Los
 * mensajes nuevos se piden solos cada pocos segundos mientras está abierto.
 *
 * `footer` es para la acción del operador ("Crear cotización").
 */
export function InquiryChat({
  inquiryId,
  onZoom,
  onRead,
}: {
  inquiryId: string;
  /** Abrir una foto en grande. */
  onZoom: (url: string) => void;
  /** Se leyó la conversación: la lista puede sacar su numerito. */
  onRead?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessageView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Fecha del último mensaje conocido: de ahí en adelante se piden los nuevos.
  const lastAt = useRef<string | null>(null);
  // ¿Estaba mirando el final? Solo entonces se baja solo al llegar algo.
  const atBottom = useRef(true);

  const append = useCallback((incoming: ChatMessageView[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set((prev ?? []).map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      return fresh.length === 0 ? prev : [...(prev ?? []), ...fresh];
    });
    lastAt.current = incoming[incoming.length - 1]!.createdAt;
  }, []);

  // Carga inicial + pedido periódico de lo nuevo (pestaña visible).
  useEffect(() => {
    let active = true;
    let busy = false;
    const pull = async (first: boolean) => {
      if (busy || (!first && document.hidden)) return;
      busy = true;
      try {
        const res = await getInquiryChatAction(
          inquiryId,
          first ? null : lastAt.current,
        );
        if (!active) return;
        if (!res.ok) {
          if (first) setFailed(true);
          return;
        }
        if (first) {
          setMessages(res.data);
          lastAt.current = res.data.at(-1)?.createdAt ?? null;
          onRead?.();
        } else {
          append(res.data);
        }
      } finally {
        busy = false;
      }
    };
    void pull(true);
    const timer = setInterval(() => void pull(false), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void pull(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // onRead queda afuera a propósito: cambia de identidad en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryId, append]);

  // Al llegar mensajes: bajar al final si ya estaba ahí (o es la carga inicial).
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  function pickPhoto(file: File | null) {
    setPhoto(file);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  async function send() {
    const body = text.trim();
    if ((!body && !photo) || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("inquiryId", inquiryId);
      fd.set("body", body);
      if (photo) {
        // Una foto de celular pesa varios MB: se achica antes de subir.
        fd.set("file", await compressImageToWebp(photo, 1600));
      }
      const res = await sendInquiryMessageAction(fd);
      if (!res.ok) {
        toast(res.error.message, "danger");
        return;
      }
      atBottom.current = true;
      append([res.data]);
      setText("");
      pickPhoto(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast("No se pudo enviar. Probá de nuevo.", "danger");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div
        ref={listRef}
        className="flex flex-col gap-2 overflow-y-auto rounded-md border border-[var(--border)] p-3"
        style={{ height: "min(52vh, 460px)" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        aria-live="polite"
      >
        {failed ? (
          <p className="text-dim m-auto text-center text-sm">
            No se pudo cargar el chat. Cerralo y volvé a abrirlo.
          </p>
        ) : messages === null ? (
          <p className="text-faint m-auto text-sm">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="text-dim m-auto max-w-xs text-center text-sm">
            Todavía no hay mensajes. Escribile al equipo por acá: lo ven al
            instante.
          </p>
        ) : (
          messages.map((m, i) => {
            const newDay =
              i === 0 ||
              dayKey(messages[i - 1]!.createdAt) !== dayKey(m.createdAt);
            return (
              <div key={m.id} className="flex flex-col gap-2">
                {newDay ? (
                  <div className="text-faint self-center text-[11px] capitalize">
                    {dayFmt.format(new Date(m.createdAt))}
                  </div>
                ) : null}
                <div
                  className={cn(
                    "flex max-w-[82%] flex-col gap-1 rounded-xl px-3 py-2",
                    m.mine ? "self-end" : "self-start",
                  )}
                  style={{
                    background: m.mine
                      ? "rgba(var(--gold-rgb), 0.16)"
                      : "var(--surface-2)",
                  }}
                >
                  {!m.mine ? (
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: "var(--gold-bright)" }}
                    >
                      {m.author}
                    </span>
                  ) : null}
                  {m.image ? (
                    <button
                      type="button"
                      className="cursor-zoom-in p-0"
                      aria-label="Ver la foto en grande"
                      onClick={() => onZoom(m.image!)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.image}
                        alt=""
                        loading="lazy"
                        className="max-h-56 w-auto max-w-full rounded-lg"
                      />
                    </button>
                  ) : null}
                  {m.body ? (
                    <p className="text-sm break-words whitespace-pre-wrap">
                      {m.body}
                    </p>
                  ) : null}
                  <time className="text-faint self-end text-[10.5px]">
                    {timeFmt.format(new Date(m.createdAt))}
                  </time>
                </div>
              </div>
            );
          })
        )}
      </div>

      {photoUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt="Foto para enviar"
            className="h-16 w-16 rounded-md object-cover"
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              pickPhoto(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Quitar foto
          </button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="btn btn-secondary"
          title="Adjuntar una foto"
          aria-label="Adjuntar una foto"
          onClick={() => fileRef.current?.click()}
        >
          📷
        </button>
        <textarea
          className="textarea"
          rows={1}
          style={{ minHeight: 42, maxHeight: 140, resize: "none" }}
          maxLength={MAX_CHAT_BODY}
          placeholder="Escribí un mensaje…"
          aria-label="Mensaje"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace un salto de línea.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          onPaste={(e) => {
            // Pegar una captura de pantalla la adjunta.
            const file = [...e.clipboardData.files].find((f) =>
              f.type.startsWith("image/"),
            );
            if (file) {
              e.preventDefault();
              pickPhoto(file);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={sending || (!text.trim() && !photo)}
          onClick={() => void send()}
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}
