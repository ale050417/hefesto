"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import type { OrderMessage } from "../messages.repository";
import { sendOrderMessageAction } from "../actions";

type Props = {
  orderId: string;
  messages: OrderMessage[];
  viewerIsStaff: boolean;
};

export function OrderChat({ orderId, messages, viewerIsStaff }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    setPending(true);
    const res = await sendOrderMessageAction(orderId, { body: value });
    setPending(false);
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
                  {m.fromStaff ? "Taller" : "Vos"}
                </span>
                <p>{m.body}</p>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="chat-form">
        <input
          className="input flex-1"
          placeholder="Escribí un mensaje…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
        />
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !body.trim()}
        >
          Enviar
        </Button>
      </form>
    </div>
  );
}
