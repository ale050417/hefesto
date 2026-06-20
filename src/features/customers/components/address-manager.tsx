"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addAddressAction, deleteAddressAction } from "../actions";
import type { Address } from "../types";

type Values = {
  label: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
};

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      label: "",
      street: "",
      city: "",
      province: "",
      postalCode: "",
      isDefault: false,
    },
  });

  const add = handleSubmit(async (values) => {
    setErr(null);
    const res = await addAddressAction(values);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  });

  async function del(id: string) {
    await deleteAddressAction(id);
    router.refresh();
  }

  return (
    <div className="ui-card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-fg font-display text-base">Direcciones</h2>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Cancelar" : "Agregar"}
        </Button>
      </div>

      {addresses.length === 0 && !open ? (
        <p className="text-dim text-sm">Todavía no cargaste direcciones.</p>
      ) : null}

      <div className="space-y-2">
        {addresses.map((a) => (
          <div
            key={a.id}
            className="border-surface-2 flex items-start justify-between gap-3 rounded-lg border p-3"
          >
            <div className="text-sm">
              <div className="text-fg flex items-center gap-2 font-medium">
                {a.label || "Dirección"}
                {a.isDefault ? <Badge variant="gold">Principal</Badge> : null}
              </div>
              <p className="text-dim">
                {a.street}, {a.city}, {a.province} ({a.postalCode})
              </p>
            </div>
            <button
              type="button"
              onClick={() => del(a.id)}
              className="text-danger text-xs hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      {open ? (
        <form
          onSubmit={add}
          className="border-surface-2 space-y-2 border-t pt-3"
        >
          {err ? (
            <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
              {err}
            </p>
          ) : null}
          <input
            className="input"
            placeholder="Etiqueta (Casa, Trabajo...)"
            {...register("label")}
          />
          <input
            className="input"
            placeholder="Dirección"
            {...register("street")}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Localidad"
              {...register("city")}
            />
            <input
              className="input"
              placeholder="Provincia"
              {...register("province")}
            />
          </div>
          <input
            className="input"
            placeholder="Código postal"
            {...register("postalCode")}
          />
          <label className="text-dim flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--gold)]"
              {...register("isDefault")}
            />
            Usar como principal
          </label>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            Guardar dirección
          </Button>
        </form>
      ) : null}
    </div>
  );
}
