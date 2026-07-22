"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { runAction } from "@/lib/run-action";
import { saveFaqAction } from "../actions";
import { DEFAULT_FAQ, type FaqItem } from "../faq-defaults";

/**
 * Editor de las preguntas frecuentes del home. Lista variable: se pueden
 * agregar, editar y quitar preguntas (hasta 12). Si nunca se guardó nada,
 * arranca con las de por defecto.
 */
export function FaqEditor({ initial }: { initial: FaqItem[] | null }) {
  const [items, setItems] = useState<FaqItem[]>(
    initial && initial.length > 0 ? initial : DEFAULT_FAQ,
  );
  const [busy, setBusy] = useState(false);

  const set = (i: number, k: "q" | "a", v: string) =>
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const add = () => setItems((arr) => [...arr, { q: "", a: "" }]);
  const remove = (i: number) =>
    setItems((arr) => arr.filter((_, j) => j !== i));

  async function save() {
    // Descartamos filas incompletas antes de guardar.
    const clean = items.filter((it) => it.q.trim() && it.a.trim());
    if (clean.length === 0) {
      toast("Cargá al menos una pregunta con su respuesta.", "danger");
      return;
    }
    setBusy(true);
    const res = await runAction(() => saveFaqAction({ items: clean }), {
      silent: true,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.error.message, "danger");
      return;
    }
    setItems(clean);
    toast("Preguntas frecuentes guardadas", "success");
  }

  return (
    <div className="ui-card section-card flex flex-col gap-4">
      <div>
        <h2 className="section-title">Preguntas frecuentes</h2>
        <p className="text-faint text-[12.5px] leading-relaxed">
          Las preguntas que se ven en la tienda. Editá, agregá o quitá las que
          quieras (hasta 12). Si las dejás todas vacías, se usan las de por
          defecto.
        </p>
      </div>

      {items.map((it, i) => (
        <div
          key={i}
          className="ui-card flex flex-col gap-2"
          style={{ padding: 14 }}
        >
          <div className="flex items-center justify-between">
            <div className="text-faint text-[11px] font-semibold tracking-wide uppercase">
              Pregunta {i + 1}
            </div>
            <button
              type="button"
              className="text-danger text-[12px] font-semibold"
              onClick={() => remove(i)}
            >
              Quitar
            </button>
          </div>
          <input
            className="input"
            placeholder="Pregunta (ej. ¿Cuánto tarda mi pedido?)"
            value={it.q}
            maxLength={140}
            onChange={(e) => set(i, "q", e.target.value)}
          />
          <textarea
            className="input"
            placeholder="Respuesta"
            value={it.a}
            maxLength={600}
            rows={3}
            onChange={(e) => set(i, "a", e.target.value)}
          />
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={items.length >= 12}
        >
          + Agregar pregunta
        </Button>
        <Button type="button" onClick={save} loading={busy}>
          Guardar preguntas
        </Button>
      </div>
    </div>
  );
}
