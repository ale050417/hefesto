import { and, eq } from "drizzle-orm";
import { db } from "@/core/db";
import { addresses, profiles } from "@/core/db/schema";
import type { Address, Profile } from "./types";

type Database = typeof db;

export async function getProfile(
  id: string,
  database: Database = db,
): Promise<Profile | null> {
  const row = await database.query.profiles.findFirst({
    where: eq(profiles.id, id),
  });
  return row ?? null;
}

export async function updateProfileRow(
  id: string,
  fields: { fullName?: string | null; phone?: string | null },
  database: Database = db,
): Promise<Profile> {
  const [row] = await database
    .update(profiles)
    .set(fields)
    .where(eq(profiles.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el perfil");
  return row;
}

export async function listAddresses(
  customerId: string,
  database: Database = db,
): Promise<Address[]> {
  return database.query.addresses.findMany({
    where: eq(addresses.customerId, customerId),
    orderBy: (a, { desc: d }) => [d(a.isDefault), d(a.createdAt)],
  });
}

export async function findAddressById(
  id: string,
  database: Database = db,
): Promise<Address | null> {
  const row = await database.query.addresses.findFirst({
    where: eq(addresses.id, id),
  });
  return row ?? null;
}

export async function insertAddress(
  values: typeof addresses.$inferInsert,
  database: Database = db,
): Promise<Address> {
  const [row] = await database.insert(addresses).values(values).returning();
  if (!row) throw new Error("No se pudo crear la dirección");
  return row;
}

export async function updateAddressRow(
  id: string,
  fields: Partial<typeof addresses.$inferInsert>,
  database: Database = db,
): Promise<Address> {
  const [row] = await database
    .update(addresses)
    .set(fields)
    .where(eq(addresses.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar la dirección");
  return row;
}

export async function deleteAddressRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(addresses).where(eq(addresses.id, id));
}

export async function clearDefaultAddresses(
  customerId: string,
  database: Database = db,
): Promise<void> {
  await database
    .update(addresses)
    .set({ isDefault: false })
    .where(and(eq(addresses.customerId, customerId)));
}
