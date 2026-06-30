"use client";

import { useUiStore } from "@/stores/uiStore";
import { AuthDialog } from "./auth-dialog";

export function AuthModal() {
  const authOpen = useUiStore((s) => s.authOpen);
  const authMode = useUiStore((s) => s.authMode);
  const closeAuth = useUiStore((s) => s.closeAuth);
  return (
    <AuthDialog open={authOpen} defaultMode={authMode} onClose={closeAuth} />
  );
}
