"use client";

import { useState } from "react";
import type {
  BusinessSettings,
  PaymentSettings,
  Role,
  ShippingSettings,
  StoreBanner,
  TeamMember,
} from "../types";
import { BrandImageUpload } from "./brand-image-upload";
import { BusinessConfigForm } from "./business-config-form";
import { PaymentSettingsForm } from "./payment-settings-form";
import { RolesManager } from "./roles-manager";
import { ShippingSettingsForm } from "./shipping-settings-form";
import { StoreAppearance } from "./store-appearance";

type Tab = "negocio" | "pagos" | "store" | "envios" | "roles";

const TABS: Array<[Tab, string]> = [
  ["negocio", "Negocio"],
  ["pagos", "Métodos de pago"],
  ["store", "Tienda"],
  ["envios", "Envíos"],
  ["roles", "Roles y permisos"],
];

export function ConfigTabs({
  settings,
  payment,
  shipping,
  banners,
  team,
  roles,
  currentUserId,
  canManageRoles,
}: {
  settings: BusinessSettings | null;
  payment: PaymentSettings | null;
  shipping: ShippingSettings | null;
  banners: StoreBanner[];
  team: TeamMember[];
  roles: Role[];
  currentUserId: string;
  canManageRoles: boolean;
}) {
  const [tab, setTab] = useState<Tab>("negocio");

  return (
    <div className="grid gap-5">
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "negocio" ? (
        <div className="grid gap-5">
          <BusinessConfigForm settings={settings} />
          <div className="grid-2">
            <BrandImageUpload
              kind="logo"
              label="Logo"
              hint="Se muestra en el header y el footer."
              currentUrl={settings?.logoUrl ?? null}
            />
            <BrandImageUpload
              kind="hero"
              label="Imagen del hero"
              hint="Banner principal del home."
              currentUrl={settings?.heroImageUrl ?? null}
            />
          </div>
        </div>
      ) : null}

      {tab === "pagos" ? <PaymentSettingsForm settings={payment} /> : null}

      {tab === "store" ? (
        <StoreAppearance settings={settings} banners={banners} />
      ) : null}

      {tab === "envios" ? <ShippingSettingsForm settings={shipping} /> : null}

      {tab === "roles" ? (
        <RolesManager
          team={team}
          roles={roles}
          canManage={canManageRoles}
          currentUserId={currentUserId}
        />
      ) : null}
    </div>
  );
}
