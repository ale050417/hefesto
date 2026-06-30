import type { ReactNode } from "react";
import { requireUser } from "@/core/auth/session";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser("/cuenta");
  return <div className="store-wrap py-8">{children}</div>;
}
