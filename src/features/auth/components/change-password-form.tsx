"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { changePasswordAction } from "../actions";

const labelCls = "mb-1 block text-xs font-medium text-dim";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setPending(true);
    const res = await changePasswordAction({
      password: String(fd.get("password") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
    });
    setPending(false);
    if (res.ok) {
      toast("Contraseña actualizada", "success");
      form.reset();
    } else {
      toast(res.error, "danger");
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-card grid gap-4 p-6">
      <h2 className="text-fg font-display text-lg">Cambiar contraseña</h2>
      <div>
        <label className={labelCls} htmlFor="password">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="confirmPassword">
          Repetir contraseña
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="input"
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Guardando…" : "Actualizar contraseña"}
        </Button>
      </div>
    </form>
  );
}
