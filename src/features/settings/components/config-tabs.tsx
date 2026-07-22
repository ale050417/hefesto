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
import { BusinessConfigForm } from "./business-config-form";
import { PaymentSettingsForm } from "./payment-settings-form";
import { RolesManager } from "./roles-manager";
import { ShippingSettingsForm } from "./shipping-settings-form";
import { StoreAppearance } from "./store-appearance";
import { TrustBarEditor } from "./trust-bar-editor";

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
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "negocio" ? <BusinessConfigForm settings={settings} /> : null}

      {tab === "pagos" ? <PaymentSettingsForm settings={payment} /> : null}

      {tab === "store" ? (
        <div className="flex flex-col gap-5">
          <StoreAppearance settings={settings} banners={banners} />
          <TrustBarEditor initial={settings?.trustBar ?? null} />
        </div>
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
