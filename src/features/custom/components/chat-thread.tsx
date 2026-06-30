"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import {
  sendCustomMessageAction,
  uploadCustomChatImageAction,
} from "../actions";
import type { CustomMessage } from "../types";

type Props = {
  requestId: string;
  messages: CustomMessage[];
  /** true cuando el que mira el chat es del taller (admin). */
  viewerIsStaff: boolean;
  disabled?: boolean;
};

export function ChatThread({
  requestId,
  messages,
  viewerIsStaff,
  disabled,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    setPending(true);
    const res = await sendCustomMessageAction(requestId, { body: value });
    setPending(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("file", file);
    const up = await uploadCustomChatImageAction(fd);
    if (!up.ok) {
      setUploading(false);
      toast(up.error.message, "danger");
      return;
    }
    // Enviamos la foto como mensaje, usando el texto actual como epígrafe.
    const res = await sendCustomMessageAction(requestId, {
      body: body.trim(),
      imageUrl: up.data.url,
    });
    setUploading(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 ? (
          <p className="text-dim text-sm">Todavía no hay mensajes.</p>
        ) : (
          messages.map((m) => {
            // "mío" = el mensaje lo escribió quien está mirando el chat.
            const mine = m.fromStaff === viewerIsStaff;
            return (
              <div
                key={m.id}
                className={cn(
                  "chat-msg",
                  mine ? "chat-msg-mine" : "chat-msg-other",
                )}
              >
                <span className="chat-msg-who">
                  {m.fromStaff ? "Taller" : "Cliente"}
                </span>
                {m.imageUrl ? (
                  <a href={m.imageUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.imageUrl}
                      alt="Foto adjunta"
                      className="mt-1 max-w-[220px] rounded-lg border border-[var(--border)]"
                    />
                  </a>
                ) : null}
                {m.body ? <p>{m.body}</p> : null}
              </div>
            );
          })
        )}
      </div>
      {disabled ? null : (
        <form onSubmit={send} className="chat-form">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickFile}
          />
          <button
            type="button"
            className="chat-clip"
            title="Adjuntar foto"
            aria-label="Adjuntar foto"
            disabled={uploading || pending}
            onClick={() => fileRef.current?.click()}
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
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            className="input flex-1"
            placeholder={uploading ? "Subiendo foto…" : "Escribí un mensaje…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            disabled={uploading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={pending || uploading || !body.trim()}
          >
            Enviar
          </Button>
        </form>
      )}
    </div>
  );
}
