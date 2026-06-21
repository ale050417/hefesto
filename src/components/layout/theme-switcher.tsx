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

export function ThemeSwitcher() {
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
