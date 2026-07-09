"use client";

import {
  passwordChecks,
  passwordLevel,
  type PasswordLevel,
} from "../password-strength";

const LEVEL_UI: Record<
  Exclude<PasswordLevel, "vacia">,
  { text: string; color: string; bars: number }
> = {
  debil: { text: "Débil", color: "var(--danger)", bars: 1 },
  media: { text: "Media", color: "var(--warning)", bars: 2 },
  fuerte: { text: "Fuerte", color: "var(--success)", bars: 3 },
};

/**
 * Medidor de fortaleza en tiempo real (Fase 8): barra de 3 segmentos +
 * checklist de criterios. Mismos criterios que valida el server (Zod usa
 * `isAcceptablePassword`), así el usuario nunca se entera "al final".
 */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const level = passwordLevel(password);
  if (level === "vacia") return null;
  const ui = LEVEL_UI[level];
  const checks = passwordChecks(password);

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors duration-200"
              style={{
                background: i <= ui.bars ? ui.color : "var(--surface-3, #ddd)",
              }}
            />
          ))}
        </div>
        <span
          className="text-xs font-medium"
          style={{ color: ui.color }}
        >{`Contraseña ${ui.text.toLowerCase()}`}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((c) => (
          <li
            key={c.id}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
              c.ok ? "text-success" : "text-dim"
            }`}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {c.ok ? (
                <path d="M20 6 9 17l-5-5" />
              ) : (
                <circle cx="12" cy="12" r="4" strokeWidth="2" />
              )}
            </svg>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
