import { redirect } from "next/navigation";
import { AcceptInvite } from "@/features/auth/components/accept-invite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitación al equipo · Hefesto 3D" };

/**
 * Aterrizaje del link de invitación (2026-07-24). NO verifica el token en el
 * GET: solo muestra la tarjeta con el botón "Aceptar" (los escáneres de
 * correo visitan los links y quemaban el token de un solo uso). La
 * verificación real la hace acceptTeamInviteAction al tocar el botón.
 */
export default async function AceptarInvitacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : "";
  const type = sp.type === "magiclink" ? "magiclink" : "invite";
  if (!tokenHash) redirect("/ingresar");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <AcceptInvite tokenHash={tokenHash} type={type} />
    </main>
  );
}
