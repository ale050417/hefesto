import { NotFoundError } from "@/core/errors";
import { getUserEmail, listAuthEmails } from "@/core/supabase/admin";
import {
  getPointsSummary,
  type PointsSummary,
} from "@/features/rewards/service";

const EMPTY_POINTS: PointsSummary = {
  balance: 0,
  earned: 0,
  redeemed: 0,
  redemptions: [],
};
import {
  clearDefaultAddresses,
  deleteAddressRow,
  findAddressById,
  getCustomerOrderAggregates,
  getDefaultCities,
  getManualCustomerById,
  getProfile,
  insertAddress,
  insertManualCustomer,
  listAddresses,
  listCustomerProfiles,
  listManualCustomers,
  listOrdersByCustomer,
  updateAddressRow,
  updateManualCustomerRow,
  updateProfileNote,
  updateProfileRow,
} from "./repository";
import type {
  AddressInput,
  ManualCustomerInput,
  ProfileInput,
} from "./schemas";
import { computeTier, type CustomerTier } from "./tier";
import type { Address, ManualCustomer, Order, Profile } from "./types";

/** Cliente unificado para el panel: registrado (profiles) o manual. */
export type AdminCustomer = {
  id: string;
  source: "registered" | "manual";
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  note: string | null;
  since: Date;
  orders: number;
  spent: number;
  tier: CustomerTier;
};

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
    birthDate: input.birthDate ?? null,
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

export async function setDefaultAddress(customerId: string, id: string) {
  await ownAddressOrThrow(customerId, id);
  await clearDefaultAddresses(customerId);
  await updateAddressRow(id, { isDefault: true });
}

export async function deleteAddress(customerId: string, id: string) {
  await ownAddressOrThrow(customerId, id);
  await deleteAddressRow(id);
}

/* ===================== Panel admin: clientes ===================== */

/** Lista unificada para el panel: registrados (con métricas) + manuales. */
export async function listAdminCustomers(): Promise<AdminCustomer[]> {
  const profilesList = await listCustomerProfiles();
  const ids = profilesList.map((p) => p.id);
  const [agg, cities, emails, manual] = await Promise.all([
    getCustomerOrderAggregates(ids),
    getDefaultCities(ids),
    listAuthEmails(),
    listManualCustomers(),
  ]);

  const registered: AdminCustomer[] = profilesList.map((p) => {
    const a = agg.get(p.id) ?? { orders: 0, spent: 0 };
    return {
      id: p.id,
      source: "registered",
      name: p.fullName ?? "Sin nombre",
      email: emails.get(p.id) ?? null,
      phone: p.phone,
      city: cities.get(p.id) ?? null,
      note: p.adminNote ?? null,
      since: p.createdAt,
      orders: a.orders,
      spent: a.spent,
      tier: computeTier(a.spent, a.orders),
    };
  });

  const manualList: AdminCustomer[] = manual.map((m) => ({
    id: m.id,
    source: "manual",
    name: m.name,
    email: m.email,
    phone: m.phone,
    city: m.city,
    note: m.note,
    since: m.createdAt,
    orders: 0,
    spent: 0,
    tier: computeTier(0, 0),
  }));

  return [...registered, ...manualList].sort(
    (a, b) => b.since.getTime() - a.since.getTime(),
  );
}

/** Detalle de un cliente (registrado o manual) + historial y puntos. */
export async function getAdminCustomer(id: string): Promise<{
  customer: AdminCustomer;
  orders: Order[];
  points: PointsSummary;
} | null> {
  const profile = await getProfile(id);
  if (profile) {
    const [aggMap, cityMap, email, custOrders, points] = await Promise.all([
      getCustomerOrderAggregates([id]),
      getDefaultCities([id]),
      getUserEmail(id),
      listOrdersByCustomer(id),
      getPointsSummary(id),
    ]);
    const a = aggMap.get(id) ?? { orders: 0, spent: 0 };
    return {
      customer: {
        id,
        source: "registered",
        name: profile.fullName ?? "Sin nombre",
        email,
        phone: profile.phone,
        city: cityMap.get(id) ?? null,
        note: profile.adminNote ?? null,
        since: profile.createdAt,
        orders: a.orders,
        spent: a.spent,
        tier: computeTier(a.spent, a.orders),
      },
      orders: custOrders,
      points,
    };
  }

  const m = await getManualCustomerById(id);
  if (m) {
    return {
      customer: {
        id: m.id,
        source: "manual",
        name: m.name,
        email: m.email,
        phone: m.phone,
        city: m.city,
        note: m.note,
        since: m.createdAt,
        orders: 0,
        spent: 0,
        tier: "bronze",
      },
      orders: [],
      points: EMPTY_POINTS,
    };
  }
  return null;
}

export async function createManualCustomer(
  input: ManualCustomerInput,
  createdBy: string,
): Promise<ManualCustomer> {
  return insertManualCustomer({
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    city: input.city ?? null,
    note: input.note ?? null,
    createdBy,
  });
}

export async function updateManualCustomer(
  id: string,
  input: ManualCustomerInput,
): Promise<ManualCustomer> {
  const row = await updateManualCustomerRow(id, {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    city: input.city ?? null,
    note: input.note ?? null,
  });
  if (!row) throw new NotFoundError("No encontramos el cliente.");
  return row;
}

/** Nota interna sobre un cliente (registrado → profiles; manual → su fila). */
export async function updateCustomerNote(
  id: string,
  source: "registered" | "manual",
  note: string | null,
): Promise<void> {
  const row =
    source === "manual"
      ? await updateManualCustomerRow(id, { note })
      : await updateProfileNote(id, note);
  if (!row) throw new NotFoundError("No encontramos el cliente.");
}
