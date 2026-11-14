import Link from "next/link";
import {
  getLegalContact,
  LegalContactList,
  LegalPage,
  LegalSection,
} from "@/components/layout/legal-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Eliminar mi cuenta",
  description:
    "Cómo eliminar tu cuenta de Hefesto 3D y qué datos se borran, desde la app o sin ella.",
};

/**
 * Cómo dar de baja la cuenta SIN la app (2026-11-14, pedido de Ale: publicar la
 * app). Play Store exige una dirección web pública para esto; App Store exige
 * la baja dentro de la app, que hace `DELETE /api/v1/me`
 * (ver `features/auth/delete-account.ts`, que es la fuente de qué se borra).
 */
export default async function EliminarCuentaPage() {
  const contact = await getLegalContact();
  const name = contact.name;
  const subject = encodeURIComponent("Eliminar mi cuenta");
  const body = encodeURIComponent(
    `Hola, quiero eliminar mi cuenta de ${name}.\n\nEl correo de mi cuenta es: `,
  );

  return (
    <LegalPage
      title="Eliminar mi cuenta"
      updated="14 de noviembre de 2026"
      intro={
        <p>
          Podés eliminar tu cuenta de <strong>{name}</strong> cuando quieras. Es
          gratis, no hace falta dar un motivo y no se puede deshacer.
        </p>
      }
    >
      <LegalSection title="Desde la app">
        <ul>
          <li>Abrí la app de {name} e ingresá con tu cuenta.</li>
          <li>
            Entrá a <strong>Cuenta</strong> (la última pestaña de abajo).
          </li>
          <li>
            Tocá <strong>Eliminar mi cuenta</strong> y confirmá.
          </li>
        </ul>
        <p>La cuenta se elimina en el momento.</p>
      </LegalSection>

      <LegalSection title="Sin la app">
        <p>
          Escribinos{" "}
          <strong>desde el correo con el que creaste la cuenta</strong> (así
          sabemos que sos vos) pidiendo la baja. La eliminamos dentro de los 10
          días hábiles y te confirmamos por el mismo medio.
        </p>
        {contact.email ? (
          <p>
            <a href={`mailto:${contact.email}?subject=${subject}&body=${body}`}>
              Enviar el pedido por correo a {contact.email}
            </a>
          </p>
        ) : null}
        <LegalContactList contact={contact} />
      </LegalSection>

      <LegalSection title="Qué se elimina">
        <ul>
          <li>
            Tu cuenta y tu acceso (correo, contraseña e ingreso con Google o
            Apple).
          </li>
          <li>Tu nombre, teléfono y fecha de nacimiento.</li>
          <li>
            Tus direcciones guardadas, favoritos, puntos y notificaciones.
          </li>
          <li>Tus pedidos a medida y sus mensajes.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Qué se conserva">
        <p>
          Si hiciste compras, el registro de cada pedido (productos, importe y
          los datos de entrega con los que se emitió el comprobante) se conserva
          durante el plazo que exigen las normas fiscales y contables, ya
          desvinculado de tu cuenta. Las reseñas que hayas publicado quedan sin
          tu identidad.
        </p>
        <p>Las cuentas del equipo de {name} las da de baja un administrador.</p>
      </LegalSection>

      <LegalSection title="Más información">
        <p>
          El detalle de cómo tratamos tus datos está en la{" "}
          <Link href="/privacidad">Política de privacidad</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
