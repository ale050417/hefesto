import { NotFoundError } from "@/core/errors";
import {
  clearDefaultAddresses,
  deleteAddressRow,
  findAddressById,
  getProfile,
  insertAddress,
  listAddresses,
  updateAddressRow,
  updateProfileRow,
} from "./repository";
import type { AddressInput, ProfileInput } from "./schemas";
import type { Address, Profile } from "./types";

export async function getAccount(
  customerId: string,
): Promise<{ profile: Profile | null; addresses: Address[] }> {
  const [profile, addresses] = await Promise.all([
    getProfile(customerId),
    listAddresses(customerId),
  ]);
  return { profile, addresses };
}

export async function updateProfile(customerId: string, input: ProfileInput) {
  return updateProfileRow(customerId, {
    fullName: input.fullName,
    phone: input.phone ?? null,
  });
}

export async function addAddress(customerId: string, input: AddressInput) {
  if (input.isDefault) await clearDefaultAddresses(customerId);
  return insertAddress({
    customerId,
    label: input.label ?? null,
    fullName: input.fullName ?? null,
    phone: input.phone ?? null,
    street: input.street,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    isDefault: input.isDefault ?? false,
  });
}

async function ownAddressOrThrow(customerId: string, id: string) {
  const address = await findAddressById(id);
  if (!address || address.customerId !== customerId) {
    throw new NotFoundError("No encontramos la dirección.");
  }
  return address;
}

export async function updateAddress(
  customerId: string,
  id: string,
  input: AddressInput,
) {
  await ownAddressOrThrow(customerId, id);
  if (input.isDefault) await clearDefaultAddresses(customerId);
  return updateAddressRow(id, {
    label: input.label ?? null,
    fullName: input.fullName ?? null,
    phone: input.phone ?? null,
    street: input.street,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode,
    isDefault: input.isDefault ?? false,
  });
}

export async function deleteAddress(customerId: string, id: string) {
  await ownAddressOrThrow(customerId, id);
  await deleteAddressRow(id);
}
