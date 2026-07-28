"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { acceptTeamInviteAction } from "../actions";

/**
 * Aterrizaje del link de invitación al equipo. El token de un solo uso se
 * consume RECIÉN al tocar el botón (un GET no lo quema: los escáneres de
 * correo visitan los links y antes invalidaban la invitación sin querer).
 * Aceptada → sesión abierta → "Creá tu contraseña" (must_change_password).
 */
export function AcceptInvite({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: "invite" | "magiclink";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    const res = await acceptTeamInviteAction({ tokenHash, type });
    if (!res.ok) {
      setBusy(false);
      setErr(res.error.message);
      return;
    }
    // Sesión abierta: el guard lleva directo a crear la contraseña.
    router.push("/cuenta/cambiar-clave");
  }

  return (
    <div className="ui-card mx-auto w-full max-w-md p-8 text-center">
      <div className="mb-4 flex justify-center">
        <BrandMark size={46} />
      </div>
      <h1 className="text-fg font-display text-2xl font-bold">
        Invitación al equipo
      </h1>
      <p className="text-dim mt-2 text-sm leading-relaxed">
        Te invitaron a sumarte al panel de gestión de{" "}
        <b className="text-fg">Hefesto 3D</b>. Al aceptar vas a crear tu
        contraseña personal — solo vos la vas a conocer.
      </p>
      <div className="mt-6">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={accept}
          loading={busy}
        >
          Aceptar y crear mi contraseña
        </Button>
      </div>
      {err ? (
        <p className="bg-danger/10 text-danger mt-4 rounded-md px-3 py-2 text-sm">
          {err}
        </p>
      ) : null}
      <p className="text-faint mt-4 text-[11.5px]">
        El link es de un solo uso. Si no esperabas esta invitación, ignorá este
        mensaje.
      </p>
    </div>
  );
}
