"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { createCustomRequestAction } from "../actions";

export function RequestForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await createCustomRequestAction({
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
      referenceImageUrl: String(fd.get("referenceImageUrl") ?? ""),
    });
    setPending(false);
    if (res.ok) {
      toast("Solicitud enviada. Te vamos a cotizar pronto.", "success");
      router.push(`/cuenta/a-medida/${res.data.id}`);
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-card grid gap-4 p-6">
      <div className="grid gap-1.5">
        <label
          className="text-dim mb-1 block text-xs font-medium"
          htmlFor="title"
        >
          Título
        </label>
        <input
          id="title"
          name="title"
          className="input"
          placeholder="Ej: Soporte para auriculares"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label
          className="text-dim mb-1 block text-xs font-medium"
          htmlFor="description"
        >
          ¿Qué necesitás?
        </label>
        <textarea
          id="description"
          name="description"
          className="input min-h-28"
          placeholder="Contanos medidas, color, uso, plazo…"
          required
        />
      </div>
      <div className="grid gap-1.5">
        <label
          className="text-dim mb-1 block text-xs font-medium"
          htmlFor="referenceImageUrl"
        >
          Imagen de referencia (URL, opcional)
        </label>
        <input
          id="referenceImageUrl"
          name="referenceImageUrl"
          className="input"
          placeholder="https://…"
        />
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enviando…" : "Pedir presupuesto"}
        </Button>
      </div>
    </form>
  );
}
