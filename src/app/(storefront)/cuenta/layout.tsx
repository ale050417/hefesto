import type { ReactNode } from "react";
import { requireUser } from "@/core/auth/session";
import { AccountNav } from "@/features/customers/components/account-nav";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser("/cuenta");
  return (
    <div className="store-wrap py-10">
      <div className="page-head">
        <div>
          <div className="eyebrow">Tu cuenta</div>
          <h1 className="page-title">Mi cuenta</h1>
        </div>
      </div>
      <AccountNav />
      {children}
    </div>
  );
}
