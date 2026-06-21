"use client";

import { useUiStore } from "@/stores/uiStore";

export function AuthTrigger() {
  const openAuth = useUiStore((s) => s.openAuth);
  return (
    <button
      type="button"
      className="store-cta"
      onClick={() => openAuth("login")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        width="15"
        height="15"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <path d="m10 17 5-5-5-5M15 12H3" />
      </svg>
      Iniciar sesión
    </button>
  );
}
