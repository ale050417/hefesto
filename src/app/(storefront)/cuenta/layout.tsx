import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/core/auth/session";
import { getBrandSettings } from "@/features/settings/service";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Vidriera digital: sin login ni checkout, "Mi cuenta" (pedidos, perfil,
  // favoritos, puntos) no tiene sentido — se corta ACÁ porque este layout
  // envuelve TODAS las subrutas de /cuenta (Ale, 2026-08-09).
  const brand = await getBrandSettings();
  if (brand.businessMode === "vidriera") redirect("/");

  await requireUser("/cuenta");
  return <div className="store-wrap py-8">{children}</div>;
}
