"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { createClient } from "@/core/supabase/browser";
import { type AuthMode, useUiStore } from "@/stores/uiStore";
import { loginAction, registerAction } from "../actions";

const MailIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="17"
    height="17"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
const LockIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="17"
    height="17"
  >
    <rect x="4" y="11" width="16" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const UserIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="17"
    height="17"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const EyeIcon = ({ off }: { off: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    width="17"
    height="17"
  >
    {off ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.4 5.2A9.5 9.5 0 0 1 12 5c5 0 9 4.5 9 7a12 12 0 0 1-2.2 3M6.2 6.2C3.9 7.6 2.4 9.8 2 12c.6 2.5 4 7 10 7a9.7 9.7 0 0 0 2.6-.4" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

function passwordScore(pw: string) {
  const crit = {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    num: /[0-9]/.test(pw),
  };
  const score = Number(crit.len) + Number(crit.upper) + Number(crit.num);
  return { crit, score };
}

export function AuthModal() {
  const { authOpen, authMode, setAuthMode, closeAuth } = useUiStore();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleClose = useCallback(() => {
    setError(null);
    setRegistered(false);
    closeAuth();
  }, [closeAuth]);

  const switchMode = (mode: AuthMode) => {
    setError(null);
    setRegistered(false);
    setAuthMode(mode);
  };

  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [authOpen, handleClose]);

  if (!authOpen) return null;
  const isLogin = authMode === "login";
  const { crit, score } = passwordScore(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    if (isLogin) {
      const res = await loginAction({ email, password });
      setPending(false);
      if (!res.ok) return setError(res.error);
      handleClose();
      router.refresh();
    } else {
      if (password !== confirm) {
        setPending(false);
        return setError("Las contraseñas no coinciden.");
      }
      const res = await registerAction({
        fullName,
        email,
        password,
        confirmPassword: confirm,
      });
      setPending(false);
      if (!res.ok) return setError(res.error);
      setRegistered(true);
    }
  }

  async function social(provider: "google" | "facebook") {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (oauthError)
      setError("No se pudo iniciar el acceso con " + provider + ".");
  }

  return (
    <div
      className="modal-backdrop"
      onClick={closeAuth}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal auth-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="text-dim hover:text-fg absolute top-4 right-4 text-xl leading-none"
        >
          ✕
        </button>

        <div className="modal-body">
          <div className="auth-logo">
            <BrandMark size={34} />
            <span className="brand-name">
              HEFESTO<b> 3D</b>
            </span>
          </div>
          <h2 className="auth-title">
            {isLogin ? "Bienvenido de vuelta" : "Creá tu cuenta"}
          </h2>
          <p className="auth-sub">
            {isLogin
              ? "Ingresá para finalizar tu compra."
              : "Registrate en segundos y empezá a comprar."}
          </p>

          {registered ? (
            <div className="auth-ok">
              ¡Cuenta creada! Si la confirmación por email está activada, revisá
              tu casilla. Después podés iniciar sesión.
            </div>
          ) : (
            <form onSubmit={onSubmit}>
              {error ? <div className="auth-error">{error}</div> : null}

              {!isLogin ? (
                <label className="auth-field">
                  <span className="af-ico">{UserIcon}</span>
                  <input
                    type="text"
                    placeholder="Nombre y apellido"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </label>
              ) : null}

              <label className="auth-field">
                <span className="af-ico">{MailIcon}</span>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="auth-field">
                <span className="af-ico">{LockIcon}</span>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Contraseña"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="af-eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={
                    showPw ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  <EyeIcon off={showPw} />
                </button>
              </label>

              {!isLogin ? (
                <>
                  <div className="pw-meter" aria-hidden>
                    {[1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={score >= i ? `pw-seg on-${score}` : "pw-seg"}
                      />
                    ))}
                  </div>
                  <div className="pw-crit">
                    <span className={crit.len ? "met" : ""}>8+ caracteres</span>
                    <span className={crit.upper ? "met" : ""}>
                      una mayúscula
                    </span>
                    <span className={crit.num ? "met" : ""}>un número</span>
                  </div>
                  <label className="auth-field">
                    <span className="af-ico">{LockIcon}</span>
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Repetir contraseña"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </label>
                </>
              ) : null}

              {isLogin ? (
                <div className="auth-row">
                  <a href="/recuperar" className="auth-link">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="auth-submit"
                disabled={pending}
              >
                {pending
                  ? "Procesando…"
                  : isLogin
                    ? "Ingresar y comprar"
                    : "Crear cuenta"}
              </Button>
            </form>
          )}

          <div className="auth-div">o accedé rápido con</div>
          <div className="auth-social">
            <button type="button" onClick={() => social("google")}>
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.9 0 5.4-1 7.2-2.7l-3.6-2.7c-1 .7-2.3 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M6 14.2a6.6 6.6 0 0 1 0-4.2V7.2H2.3a11 11 0 0 0 0 9.8z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.2L6 10c.9-2.6 3.2-4.5 6-4.5z"
                />
              </svg>
              Google
            </button>
            <button type="button" onClick={() => social("facebook")}>
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden>
                <path
                  fill="#1877F2"
                  d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"
                />
              </svg>
              Facebook
            </button>
          </div>

          <p className="auth-switch">
            {isLogin ? "¿No tenés cuenta? " : "¿Ya tenés cuenta? "}
            <button
              type="button"
              className="auth-link"
              onClick={() => switchMode(isLogin ? "register" : "login")}
            >
              {isLogin ? "Registrate gratis" : "Iniciá sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
