import { requireUser } from "@/core/auth/session";
import { AccountShell } from "@/features/customers/components/account-shell";
import { AddressManager } from "@/features/customers/components/address-manager";
import { ProfileForm } from "@/features/customers/components/profile-form";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { getAccount } from "@/features/customers/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Perfil y direcciones" };

export default async function ProfilePage() {
  const user = await requireUser("/cuenta/perfil");
  const { profile, addresses } = await getAccount(user.id);

  return (
    <AccountShell>
      <div className="flex flex-col gap-5">
        <ProfileForm
          fullName={profile?.fullName ?? ""}
          phone={profile?.phone ?? ""}
          birthDate={profile?.birthDate ?? ""}
        />
        <AddressManager addresses={addresses} />
        <ChangePasswordForm />
      </div>
    </AccountShell>
  );
}
