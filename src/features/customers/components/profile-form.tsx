"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "../actions";
import { runAction } from "@/lib/run-action";

type Values = { fullName: string; phone: string; birthDate: string };

export function ProfileForm({
  fullName,
  phone,
  birthDate,
}: {
  fullName: string;
  phone: string;
  birthDate: string;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({ defaultValues: { fullName, phone, birthDate } });

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    setErr(null);
    const res = await runAction(() => updateProfileAction(values), {
      silent: true,
    });
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    setMsg("Datos guardados.");
  });

  return (
    <form onSubmit={onSubmit} className="ui-card p-6">
      <h2 className="text-fg font-display mb-5 text-lg font-bold">
        Datos personales
      </h2>
      {err ? (
        <p className="bg-danger/10 text-danger mb-4 rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="bg-success/10 text-success mb-4 rounded-md px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-dim mb-1.5 block text-xs">
            Nombre y apellido
          </label>
          <input className="input" {...register("fullName")} />
        </div>
        <div>
          <label className="text-dim mb-1.5 block text-xs">
            Teléfono / WhatsApp
          </label>
          <input className="input" {...register("phone")} />
        </div>
        <div>
          <label className="text-dim mb-1.5 block text-xs">
            Cumpleaños{" "}
            <span className="text-faint">(para cupones de cumple)</span>
          </label>
          <input type="date" className="input" {...register("birthDate")} />
        </div>
      </div>
      <Button type="submit" loading={isSubmitting}>
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
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Guardar cambios
      </Button>
    </form>
  );
}
