import { eq } from "drizzle-orm";
import { db } from "@/core/db";
import { coupons } from "@/core/db/schema";
import type { Coupon } from "./types";

type Database = typeof db;

export async function findByCode(
  code: string,
  database: Database = db,
): Promise<Coupon | null> {
  const row = await database.query.coupons.findFirst({
    where: eq(coupons.code, code),
  });
  return row ?? null;
}

export async function findCouponById(
  id: string,
  database: Database = db,
): Promise<Coupon | null> {
  const row = await database.query.coupons.findFirst({
    where: eq(coupons.id, id),
  });
  return row ?? null;
}

export async function listCoupons(database: Database = db): Promise<Coupon[]> {
  return database.query.coupons.findMany({
    orderBy: (c, { desc: d }) => [d(c.createdAt)],
  });
}

export async function insertCoupon(
  values: typeof coupons.$inferInsert,
  database: Database = db,
): Promise<Coupon> {
  const [row] = await database.insert(coupons).values(values).returning();
  if (!row) throw new Error("No se pudo crear el cupón");
  return row;
}

export async function updateCouponRow(
  id: string,
  fields: Partial<typeof coupons.$inferInsert>,
  database: Database = db,
): Promise<Coupon> {
  const [row] = await database
    .update(coupons)
    .set(fields)
    .where(eq(coupons.id, id))
    .returning();
  if (!row) throw new Error("No se pudo actualizar el cupón");
  return row;
}

/** Borra el cupón. Sus canjes (coupon_redemptions) cascadean por su FK. */
export async function deleteCouponRow(
  id: string,
  database: Database = db,
): Promise<void> {
  await database.delete(coupons).where(eq(coupons.id, id));
}
