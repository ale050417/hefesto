"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/stores/toastStore";
import { saveBusinessInfoAction } from "../actions";
import type { BusinessSettings } from "../types";
import { runAction } from "@/lib/run-action";

const labelCls = "mb-1 block text-xs font-medium text-dim";

export function BusinessInfoForm({
  settings,
}: {
  settings: BusinessSettings | null;
}) {
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await runAction(
      () =>
        saveBusinessInfoAction({
          storeName: String(fd.get("storeName") ?? ""),
          slogan: String(fd.get("slogan") ?? ""),
          description: String(fd.get("description") ?? ""),
          whatsapp: String(fd.get("whatsapp") ?? ""),
          contactEmail: String(fd.get("contactEmail") ?? ""),
          addressText: String(fd.get("addressText") ?? ""),
          instagram: String(fd.get("instagram") ?? ""),
          facebook: String(fd.get("facebook") ?? ""),
        }),
      { silent: true },
    );
    setPending(false);
    if (res.ok) {
      toast("Configuración guardada", "success");
    } else {
      toast(res.error.message, "danger");
    }
  }

  return (
    <form onSubmit={onSubmit} className="ui-card grid gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="storeName">
            Nombre del negocio
          </label>
          <input
            id="storeName"
            name="storeName"
            className="input"
            defaultValue={settings?.storeName ?? ""}
            placeholder="Hefesto 3D"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="slogan">
            Eslogan (bajo el logo)
          </label>
          <input
            id="slogan"
            name="slogan"
            className="input"
            defaultValue={settings?.slogan ?? ""}
            placeholder="Forjado en capas"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="whatsapp">
            WhatsApp (con código país)
          </label>
          <input
            id="whatsapp"
            name="whatsapp"
            className="input"
            defaultValue={settings?.whatsapp ?? ""}
            placeholder="5493815551234"
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="description">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          className="input min-h-20"
          defaultValue={settings?.description ?? ""}
          placeholder="Impresión 3D a pedido…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="contactEmail">
            Email de contacto
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            className="input"
            defaultValue={settings?.contactEmail ?? ""}
            placeholder="hola@hefesto3d.com"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="addressText">
            Dirección
          </label>
          <input
            id="addressText"
            name="addressText"
            className="input"
            defaultValue={settings?.addressText ?? ""}
            placeholder="Av. Siempre Viva 123"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="instagram">
            Instagram (URL o usuario)
          </label>
          <input
            id="instagram"
            name="instagram"
            className="input"
            defaultValue={settings?.instagram ?? ""}
            placeholder="@hefesto3d"
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="facebook">
            Facebook (URL o usuario)
          </label>
          <input
            id="facebook"
            name="facebook"
            className="input"
            defaultValue={settings?.facebook ?? ""}
            placeholder="hefesto3d"
          />
        </div>
      </div>
      <div>
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>
    </form>
  );
}
