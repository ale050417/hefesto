"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Widget flotante del asistente IA del admin (burbuja abajo a la derecha).
 * Historial en memoria de la pestaña (sin persistencia). El servidor valida
 * staff + rate limit; acá solo UI. Si falta la API key, el endpoint devuelve
 * 501 con instrucciones y se muestran tal cual.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autoscroll al último mensaje y foco al abrir.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Enviamos solo los últimos 12 turnos: contexto suficiente y barato.
        body: JSON.stringify({ messages: history.slice(-12) }),
      });
      const data = (await res.json().catch(() => null)) as {
        reply?: string;
        error?: string;
      } | null;
      if (!res.ok || !data?.reply) {
        setError(data?.error ?? "El asistente no pudo responder.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply! },
        ]);
      }
    } catch {
      setError("No hubo conexión con el asistente. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Burbuja */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente IA"}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          background:
            "linear-gradient(135deg, var(--gold), var(--gold-bright, var(--gold)))",
          color: "#141414",
        }}
      >
        {open ? (
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3l1.6 4.2L18 8.8l-4.4 1.6L12 14.6l-1.6-4.2L6 8.8l4.4-1.6z" />
            <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 15l.6 1.7L7.4 17l-1.8.6L5 19.4l-.6-1.8L2.6 17l1.8-.6z" />
          </svg>
        )}
      </button>

      {/* Panel de chat */}
      {open ? (
        <div
          role="dialog"
          aria-label="Asistente IA"
          className="ui-card fixed right-4 bottom-20 z-40 flex h-[480px] w-[min(92vw,380px)] flex-col overflow-hidden p-0"
        >
          <div
            className="border-b px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="eyebrow">Hefesto IA</div>
            <div className="text-dim text-xs">
              Preguntame por ventas, stock, pedidos o impresión 3D
            </div>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="text-dim px-2 py-6 text-center text-xs">
                Ejemplos: “¿cuánto vendimos este mes?” · “¿qué filamento está
                por agotarse?” · “¿por qué se me despega la primera capa?”
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                  m.role === "user" ? "ml-auto" : "mr-auto",
                )}
                style={
                  m.role === "user"
                    ? {
                        background: "rgba(var(--gold-rgb), 0.16)",
                        color: "var(--text)",
                      }
                    : { background: "var(--hover)", color: "var(--text)" }
                }
              >
                {m.content}
              </div>
            ))}
            {busy ? (
              <div
                className="text-dim mr-auto rounded-lg px-3 py-2 text-[13px]"
                style={{ background: "var(--hover)" }}
              >
                Pensando…
              </div>
            ) : null}
            {error ? (
              <div
                className="mr-auto max-w-[92%] rounded-lg px-3 py-2 text-[12.5px]"
                style={{
                  background: "rgba(217, 106, 90, 0.12)",
                  color: "var(--danger)",
                }}
              >
                {error}
              </div>
            ) : null}
          </div>

          <form
            className="flex items-center gap-2 border-t p-2"
            style={{ borderColor: "var(--border)" }}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu pregunta…"
              maxLength={4000}
              className="input flex-1 text-sm"
              disabled={busy}
            />
            <button
              type="submit"
              className="btn btn-primary px-3 py-2 text-sm"
              disabled={busy || input.trim().length === 0}
            >
              Enviar
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
