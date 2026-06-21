"use client";

import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn("toast", t.variant !== "default" && t.variant)}
          onClick={() => remove(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
