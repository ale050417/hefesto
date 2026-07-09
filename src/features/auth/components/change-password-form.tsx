"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { changePasswordAction } from "../actions";
import { runAction } from "@/lib/run-action";
import { PasswordStrengthMeter } from "./password-strength-meter";

const labelCls = "mb-1 block text-xs font-medium text-dim";

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li
      className="flex items-center gap-2 text-[12.5px]"
      style={{ color: ok ? "var(--success)" : "var(--text-faint)" }}
    >
      <span aria-hidden style={{ width: 14, display: "inline-flex" }}>
        {ok ? (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          "•"
        )}
      </span>
      {children}
    </li>
  );
}

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  const longEnough = password.length >= 8;
  const matches = confirm.length > 0 && password === confirm;
  const valid = longEnough && matches;

  // Mensaje de por qué no se puede guardar todavía (solo si empezó a escribir).
  let hint: string | null = null;
  if (password.length > 0 && !longEnough) {
    hint = `Te faltan ${8 - password.length} caracteres (mínimo 8).`;
  } else if (longEnough && confirm.length > 0 && !matches) {
    hint = "Las contraseñas no coinciden.";
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    setPending(true);
    const res = await runAction(
      () =>
        changePasswordAction({
          password,
          confirmPassword: confirm,
        }),
      { silent: true },
    );
    setPending(false);
    if (res.ok) {
      toast("Contraseña actualizada", "success");
      setPassword("");
      setConfirm("");
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-card p-6">
      <h2 className="text-fg font-display text-lg font-bold">Seguridad</h2>
      <p className="text-faint mt-1 mb-5 text-[13px]">
        Elegí una contraseña nueva para tu cuenta.
      </p>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
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
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={password.length > 0 && !longEnough}
            required
          />
          <PasswordStrengthMeter password={password} />
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
            placeholder="Repetí la contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={confirm.length > 0 && !matches}
            required
          />
        </div>
      </div>

      {/* Requisitos en vivo: el usuario ve qué falta y qué ya cumple. */}
      <ul
        className="mb-4 grid gap-1"
        style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}
      >
        <Rule ok={longEnough}>Al menos 8 caracteres</Rule>
        <Rule ok={matches}>Las dos contraseñas coinciden</Rule>
      </ul>

      {hint ? (
        <p className="bg-danger/10 text-danger mb-4 rounded-md px-3 py-2 text-[12.5px]">
          {hint}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={pending || !valid}>
        {pending ? "Guardando…" : "Actualizar contraseña"}
      </Button>
    </form>
  );
}
