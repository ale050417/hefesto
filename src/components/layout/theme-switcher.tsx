"use client";

import { useState } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "warm";
const THEMES: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Claro", icon: "☀" },
  { value: "dark", label: "Oscuro", icon: "☾" },
  { value: "warm", label: "Cálido", icon: "✦" },
];

export function ThemeSwitcher({
  compact = false,
}: {
  /** true = un solo botón que va ciclando claro → oscuro → cálido. */
  compact?: boolean;
} = {}) {
  const mounted = useMounted();
  const [override, setOverride] = useState<Theme | null>(null);
  const current: Theme =
    override ??
    (mounted
      ? ((document.documentElement.getAttribute("data-theme") as Theme) ??
        "light")
      : "light");

  function apply(t: Theme) {
    setOverride(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("hefesto-theme", t);
    } catch {
      /* ignore */
    }
  }

  if (compact) {
    const idx = THEMES.findIndex((t) => t.value === current);
    const active = THEMES[idx === -1 ? 0 : idx]!;
    const next = THEMES[(idx + 1) % THEMES.length]!;
    return (
      <button
        type="button"
        onClick={() => apply(next.value)}
        title={`Tema: ${active.label} (tocar para ${next.label.toLowerCase()})`}
        aria-label={`Cambiar tema (actual: ${active.label})`}
        className="bg-surface-2 border-surface-3 text-dim hover:text-fg inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors"
      >
        {active.icon}
      </button>
    );
  }

  return (
    <div className="bg-surface-2 border-surface-3 inline-flex rounded-full border p-0.5">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => apply(t.value)}
          title={t.label}
          aria-label={`Tema ${t.label}`}
          aria-pressed={current === t.value}
          className={cn(
            "h-7 w-7 rounded-full text-sm transition-colors",
            current === t.value
              ? "bg-primary text-primary-fg"
              : "text-dim hover:text-fg",
          )}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
