import Link from "next/link";
import { requireUser } from "@/core/auth/session";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cambiar contraseña" };

export default async function CambiarClavePage() {
  const user = await requireUser("/cuenta/cambiar-clave");
  const forced = user.profile?.mustChangePassword ?? false;
  const isStaff =
    user.profile?.role === "admin" || user.profile?.role === "operator";

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div>
        <h1 className="text-fg font-display text-2xl font-bold">
          {forced ? "Creá tu contraseña" : "Cambiar contraseña"}
        </h1>
        {forced ? (
          <p className="text-faint mt-1 text-[13px]">
            ¡Bienvenido/a al equipo! Definí tu contraseña personal — solo vos la
            vas a conocer — para continuar al panel.
          </p>
        ) : null}
      </div>

      {/* Al guardar bien redirige SOLO al destino (sin pasos manuales,
          2026-07-24). Si está mal, el form no deja avanzar. */}
      <ChangePasswordForm redirectTo={isStaff ? "/admin" : "/cuenta"} />

      {isStaff && !forced ? (
        <Link href="/admin" className="text-dim text-sm hover:underline">
          ← Volver al panel
        </Link>
      ) : null}
    </div>
  );
}
