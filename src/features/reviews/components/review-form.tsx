"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { createReviewAction } from "../actions";
import { runAction } from "@/lib/run-action";

export function ReviewForm({
  productId,
  slug,
}: {
  productId: string;
  slug: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setErr("Elegí una puntuación.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await runAction(
      () => createReviewAction(productId, slug, { rating, comment }),
      { silent: true },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    toast("¡Gracias! Tu reseña quedó pendiente de aprobación.", "success");
    setRating(0);
    setComment("");
  }

  return (
    <form onSubmit={submit} className="ui-card space-y-3 p-4">
      <h3 className="text-fg font-display text-sm">Dejá tu reseña</h3>
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      <div className="flex gap-1" style={{ color: "var(--gold)" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setRating(i)}
            aria-label={`${i} estrellas`}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill={i <= rating ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        className="textarea"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contanos qué te pareció (opcional)"
      />
      <Button type="submit" loading={busy}>
        Enviar reseña
      </Button>
    </form>
  );
}
