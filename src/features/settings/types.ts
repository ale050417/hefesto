import type {
  businessSettings,
  paymentSettings,
  profiles,
  roles,
  shippingSettings,
  storeBanners,
} from "@/core/db/schema";

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type StoreBanner = typeof storeBanners.$inferSelect;
export type PaymentSettings = typeof paymentSettings.$inferSelect;
export type ShippingSettings = typeof shippingSettings.$inferSelect;

/** Rol personalizado (capa de permisos sobre el enum de acceso). */
export type Role = typeof roles.$inferSelect;

type Profile = typeof profiles.$inferSelect;
export type UserRole = Profile["role"];
export type UserRow = {
  id: string;
  fullName: string | null;
  role: UserRole;
  roleId: string | null;
  createdAt: Date;
};

export type TeamStatus = "activo" | "invitado";
export type StaffRole = Extract<UserRole, "admin" | "operator">;
export type TeamMember = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: StaffRole;
  /** Rol custom asignado (capa de permisos), o null. */
  roleId: string | null;
  roleName: string | null;
  status: TeamStatus;
};

export type BrandSettings = {
  logoUrl: string | null;
  heroImageUrl: string | null;
  storeName: string | null;
  slogan: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  contactEmail: string | null;
  accentColor: string | null;
  season: string;
  seasonDeco: boolean;
  seasonIntensity: number;
  seasonDurationSec: number;
  homeSections: Record<string, boolean> | null;
  trustBar: Array<{ ic: string; t: string; d: string }> | null;
  faq: Array<{ q: string; a: string }> | null;
  bannerIntervalSec: number;
};
