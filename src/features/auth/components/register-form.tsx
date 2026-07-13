"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { registerAction } from "../actions";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { runAction } from "@/lib/run-action";

type Values = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

export function RegisterForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  // useWatch (no watch()) para ser compatible con el React Compiler.
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await runAction(() => registerAction(values), { silent: true });
    if (!res.ok) {
      setFormError(res.error.message);
      return;
    }
    setDone(true);
  });

  if (done) {
    return (
      <p className="bg-success/10 text-fg rounded-md px-3 py-3 text-sm">
        ¡Cuenta creada! Si la confirmación por email está activada, revisá tu
        casilla. Después podés iniciar sesión.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {formError ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}
      <div>
        <label className={labelCls} htmlFor="fullName">
          Nombre
        </label>
        <input id="fullName" className={field} {...register("fullName")} />
        {errors.fullName ? (
          <p className="text-danger mt-1 text-xs">{errors.fullName.message}</p>
        ) : null}
      </div>
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
      <div>
        <label className={labelCls} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className={field}
          {...register("password")}
        />
        <PasswordStrengthMeter password={password} />
        {errors.password ? (
          <p className="text-danger mt-1 text-xs">{errors.password.message}</p>
        ) : null}
      </div>
      <div>
        <label className={labelCls} htmlFor="confirmPassword">
          Repetir contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={field}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-danger mt-1 text-xs">
            {errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
