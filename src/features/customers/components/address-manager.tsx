"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "../actions";
import type { Address } from "../types";

type Values = {
  label: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  isDefault: boolean;
};

const EMPTY: Values = {
  label: "",
  street: "",
  city: "",
  province: "",
  postalCode: "",
  isDefault: false,
};

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({ defaultValues: EMPTY });

  const onSubmit = handleSubmit(async (values) => {
    setErr(null);
    const res = editId
      ? await updateAddressAction(editId, values)
      : await addAddressAction(values);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    reset(EMPTY);
    setOpen(false);
    setEditId(null);
    router.refresh();
  });

  function startNew() {
    reset(EMPTY);
    setEditId(null);
    setErr(null);
    setOpen((o) => !o);
  }

  function startEdit(a: Address) {
    reset({
      label: a.label ?? "",
      street: a.street,
      city: a.city,
      province: a.province ?? "",
      postalCode: a.postalCode ?? "",
      isDefault: a.isDefault,
    });
    setEditId(a.id);
    setErr(null);
    setOpen(true);
  }

  async function del(id: string) {
    await deleteAddressAction(id);
    router.refresh();
  }

  async function makeDefault(id: string) {
    await setDefaultAddressAction(id);
    router.refresh();
  }

  return (
    <div className="ui-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-fg font-display text-lg font-bold">
            Mis direcciones
          </h2>
          <div className="text-faint mt-0.5 text-[12.5px]">
            Para envíos a domicilio
          </div>
        </div>
        <Button
          size="sm"
          variant={open ? "secondary" : "primary"}
          onClick={startNew}
        >
          {open ? (
            "Cancelar"
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="15"
                height="15"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Agregar
            </>
          )}
        </Button>
      </div>

      {addresses.length === 0 && !open ? (
        <div className="text-faint flex flex-col items-center py-8 text-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            width="36"
            height="36"
            aria-hidden
          >
            <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
          </svg>
          <div className="mt-2 text-sm">No tenés direcciones guardadas</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {addresses.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-[var(--border)] p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="grid h-8 w-8 place-items-center rounded-lg"
                  style={{
                    background: "rgba(var(--gold-rgb),.12)",
                    color: "var(--gold-bright)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="16"
                    height="16"
                    aria-hidden
                  >
                    <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
                  </svg>
                </span>
                <b className="text-fg">{a.label || "Dirección"}</b>
                {a.isDefault ? <Badge variant="gold">Principal</Badge> : null}
              </div>
              <div className="flex items-center gap-1">
                {!a.isDefault ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => makeDefault(a.id)}
                  >
                    Hacer principal
                  </Button>
                ) : null}
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  aria-label="Editar dirección"
                  className="btn btn-ghost btn-icon text-faint hover:text-fg"
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
                    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => del(a.id)}
                  aria-label="Eliminar dirección"
                  className="btn btn-ghost btn-icon text-faint hover:text-danger"
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
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-dim pl-10 text-[13px] leading-relaxed">
              {a.street}
              <br />
              {a.city}
              {a.province ? `, ${a.province}` : ""}
              {a.postalCode ? ` · ${a.postalCode}` : ""}
            </p>
          </div>
        ))}
      </div>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="mt-3 space-y-2 border-t border-[var(--border)] pt-4"
        >
          <div className="text-fg text-sm font-semibold">
            {editId ? "Editar dirección" : "Nueva dirección"}
          </div>
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
            {editId ? "Guardar cambios" : "Guardar dirección"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
