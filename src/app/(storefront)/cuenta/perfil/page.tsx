import { requireUser } from "@/core/auth/session";
import { AddressManager } from "@/features/customers/components/address-manager";
import { ProfileForm } from "@/features/customers/components/profile-form";
import { getAccount } from "@/features/customers/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Perfil y direcciones" };

export default async function ProfilePage() {
  const user = await requireUser("/cuenta/perfil");
  const { profile, addresses } = await getAccount(user.id);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ProfileForm
        fullName={profile?.fullName ?? ""}
        phone={profile?.phone ?? ""}
      />
      <AddressManager addresses={addresses} />
    </div>
  );
}
