"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { updateProfileAction } from "../actions";

type Values = { fullName: string; phone: string };

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Values>({ defaultValues: { fullName, phone } });

  const onSubmit = handleSubmit(async (values) => {
    setMsg(null);
    setErr(null);
    const res = await updateProfileAction(values);
    if (!res.ok) {
      setErr(res.error.message);
      return;
    }
    setMsg("Datos guardados.");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="ui-card space-y-3 p-5">
      <h2 className="text-fg font-display text-base">Mis datos</h2>
      {err ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="bg-success/10 text-success rounded-md px-3 py-2 text-sm">
          {msg}
        </p>
      ) : null}
      <div>
        <label className="text-dim mb-1 block text-xs">Nombre y apellido</label>
        <input className="input" {...register("fullName")} />
      </div>
      <div>
        <label className="text-dim mb-1 block text-xs">Teléfono</label>
        <input className="input" {...register("phone")} />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        Guardar
      </Button>
    </form>
  );
}
