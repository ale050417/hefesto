"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction } from "../actions";
import { runAction } from "@/lib/run-action";

type Values = { email: string };

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

export function ResetForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    // La respuesta es neutra a propósito (no revela si el email existe), pero
    // un fallo REAL (red caída, timeout) sí se muestra: antes marcaba "listo"
    // aunque la request nunca hubiera llegado.
    const res = await runAction(() => requestPasswordResetAction(values));
    if (res.ok) setDone(true);
  });

  if (done) {
    return (
      <p className="bg-surface-2 text-dim rounded-md px-3 py-3 text-sm">
        Si el email está registrado, te enviamos instrucciones para recuperar tu
        contraseña.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className={field}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-danger mt-1 text-xs">{errors.email.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando..." : "Enviar instrucciones"}
      </Button>
    </form>
  );
}
