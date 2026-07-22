"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { updateCustomerNoteAction } from "../actions";
import { runAction } from "@/lib/run-action";

export function CustomerNoteForm({
  id,
  source,
  note,
}: {
  id: string;
  source: "registered" | "manual";
  note: string | null;
}) {
  const [value, setValue] = useState(note ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await runAction(
        () => updateCustomerNoteAction(id, source, { note: value }),
        { silent: true },
      );
      if (res.ok) {
        toast("Nota guardada", "success");
      } else {
        toast(res.error.message, "danger");
      }
    } catch {
      toast("No se pudo guardar. Intentá de nuevo.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label htmlFor="cust-note">Nota interna</label>
      <textarea
        id="cust-note"
        className="textarea"
        placeholder="Preferencias, observaciones..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <Button type="button" size="sm" onClick={save} loading={busy}>
          Guardar nota
        </Button>
      </div>
    </div>
  );
}
