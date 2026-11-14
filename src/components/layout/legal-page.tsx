import type { ReactNode } from "react";
import {
  getBrandSettings,
  getPublicStoreInfo,
} from "@/features/settings/service";

/**
 * Marco de las páginas legales públicas (`/privacidad`, `/eliminar-cuenta`).
 * Existen porque App Store y Play Store las exigen para publicar la app
 * (2026-11-14, pedido de Ale): la política de privacidad tiene que tener una
 * dirección pública, y la baja de cuenta tiene que poder pedirse sin la app.
 */

export type LegalContact = {
  name: string;
  email: string | null;
  whatsapp: string | null;
  whatsappHref: string | null;
  address: string | null;
};

/**
 * Datos de contacto reales del negocio (los mismos del pie de página). Si la
 * base no responde, la página se muestra igual, sin esos datos: un texto legal
 * no puede depender de una consulta.
 */
export async function getLegalContact(): Promise<LegalContact> {
  const [info, brand] = await Promise.all([
    getPublicStoreInfo().catch(() => null),
    getBrandSettings().catch(() => null),
  ]);
  const whatsapp = (info?.whatsapp ?? brand?.whatsapp ?? "").trim() || null;
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  return {
    name: (info?.storeName ?? brand?.storeName ?? "").trim() || "Hefesto 3D",
    email: (info?.contactEmail ?? brand?.contactEmail ?? "").trim() || null,
    whatsapp,
    whatsappHref: digits
      ? `https://wa.me/${digits.length <= 10 ? "54" + digits : digits}`
      : null,
    address: (info?.addressText ?? "").trim() || null,
  };
}

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** Fecha de la última actualización, ya escrita ("14 de noviembre de 2026"). */
  updated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="store-wrap py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-primary font-display text-[11px] font-bold tracking-[0.2em] uppercase">
          Legales
        </p>
        <h1 className="text-fg font-display mt-2 text-2xl font-bold sm:text-3xl">
          {title}
        </h1>
        <p className="text-faint mt-2 text-xs">
          Última actualización: {updated}
        </p>
        {intro ? (
          <div className="text-dim mt-5 text-[15px] leading-relaxed">
            {intro}
          </div>
        ) : null}
        <div className="mt-8 grid gap-8">{children}</div>
      </div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-fg text-lg font-bold">{title}</h2>
      <div className="text-dim mt-3 grid gap-3 text-[15px] leading-relaxed [&_a]:text-[var(--gold-bright)] [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-[var(--text)] [&_ul]:grid [&_ul]:gap-1.5">
        {children}
      </div>
    </section>
  );
}

/** Bloque con las formas de contacto (correo, WhatsApp, domicilio). */
export function LegalContactList({ contact }: { contact: LegalContact }) {
  return (
    <ul>
      {contact.email ? (
        <li>
          Correo: <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </li>
      ) : null}
      {contact.whatsapp && contact.whatsappHref ? (
        <li>
          WhatsApp:{" "}
          <a
            href={contact.whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
          >
            {contact.whatsapp}
          </a>
        </li>
      ) : null}
      {contact.address ? <li>Domicilio: {contact.address}</li> : null}
    </ul>
  );
}
