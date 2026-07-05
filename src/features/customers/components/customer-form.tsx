"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import {
  createManualCustomerAction,
  updateManualCustomerAction,
} from "../actions";

export type ManualCustomerFormData = {
  id?: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  note: string | null;
};

export function CustomerForm({
  customer,
  onDone,
  onCancel,
}: {
  customer?: ManualCustomerFormData;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const edit = !!customer?.id;
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    city: customer?.city ?? "",
    note: customer?.note ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res =
        edit && customer?.id
          ? await updateManualCustomerAction(customer.id, form)
          : await createManualCustomerAction(form);
      if (!res.ok) return setErr(res.error.message);
      toast(edit ? "Cliente actualizado" : "Cliente creado", "success");
      onDone?.();
      router.refresh();
    } catch {
      setErr("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const initial = (form.name[0] || "?").toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {edit ? null : (
        <p className="text-faint text-[13px] leading-relaxed">
          Cargá un cliente que compró sin registrarse (por WhatsApp, teléfono o
          en el local). Queda en tu base para asociarle pedidos.
        </p>
      )}

      <div className="flex items-center gap-4">
        <span
          className="avatar flex-shrink-0"
          style={{ width: 54, height: 54, fontSize: 21 }}
        >
          {initial}
        </span>
        <div className="field grow">
          <label htmlFor="cf-name">Nombre y apellido</label>
          <input
            id="cf-name"
            className="input"
            placeholder="Ej: Juan Pérez"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="cf-email">
            Email <span className="text-faint font-normal">(opcional)</span>
          </label>
          <input
            id="cf-email"
            type="email"
            className="input"
            placeholder="juan@email.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="cf-phone">Teléfono / WhatsApp</label>
          <input
            id="cf-phone"
            className="input"
            placeholder="+54 11 ..."
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cf-city">Ciudad</label>
        <input
          id="cf-city"
          className="input"
          placeholder="Buenos Aires"
          value={form.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="cf-note">
          Nota interna{" "}
          <span className="text-faint font-normal">(opcional)</span>
        </label>
        <textarea
          id="cf-note"
          className="textarea"
          placeholder="Preferencias, cómo llegó, observaciones..."
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </div>

      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
        <Button type="button" variant="secondary" onClick={() => onCancel?.()}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} loading={busy}>
          {busy ? "Guardando…" : edit ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </div>
  );
}
