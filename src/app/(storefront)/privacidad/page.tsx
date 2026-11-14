import Link from "next/link";
import {
  getLegalContact,
  LegalContactList,
  LegalPage,
  LegalSection,
} from "@/components/layout/legal-page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Política de privacidad",
  description:
    "Qué datos personales trata Hefesto 3D en su tienda web y en su app, para qué los usa y cómo pedir que se corrijan o eliminen.",
};

/**
 * Política de privacidad de la tienda web y de la app (2026-11-14, pedido de
 * Ale: publicar la app en App Store y Play Store, que exigen esta página).
 *
 * El texto describe lo que el sistema hace DE VERDAD. Si se suma algo que
 * cambie el tratamiento de datos (analítica, notificaciones push, un proveedor
 * nuevo), hay que actualizarlo acá y en las fichas de las tiendas.
 */
export default async function PrivacidadPage() {
  const contact = await getLegalContact();
  const name = contact.name;

  return (
    <LegalPage
      title="Política de privacidad"
      updated="14 de noviembre de 2026"
      intro={
        <p>
          Esta política explica qué datos personales trata{" "}
          <strong>{name}</strong> cuando usás nuestra tienda web
          (hefesto3d.com.ar) o nuestra app para Android y iPhone, para qué los
          usamos y qué podés hacer con ellos. Aplica la Ley 25.326 de Protección
          de los Datos Personales de la República Argentina.
        </p>
      }
    >
      <LegalSection title="1. Quién es responsable de tus datos">
        <p>
          El responsable es {name}, taller de impresión 3D. Para cualquier
          consulta sobre tus datos podés escribirnos:
        </p>
        <LegalContactList contact={contact} />
      </LegalSection>

      <LegalSection title="2. Qué datos tratamos y para qué">
        <p>
          <strong>Sin cuenta.</strong> Podés ver el catálogo completo sin
          registrarte. Los productos que marcás como favoritos y el modo de
          color que elegís se guardan únicamente en tu dispositivo: no llegan a
          nuestros servidores. Como en cualquier servicio en línea, la
          infraestructura registra datos técnicos de cada conexión (dirección
          IP, tipo de dispositivo, fecha y hora) para que el servicio funcione y
          para protegerlo de abusos.
        </p>
        <p>
          <strong>Si creás una cuenta.</strong> Guardamos tu correo electrónico
          y tu nombre, y —solo si los cargás— tu teléfono y tu fecha de
          nacimiento. Los usamos para identificarte, darte acceso y, si hacés un
          pedido, poder contactarte. Tu contraseña se guarda cifrada: nadie de
          nuestro equipo puede verla.
        </p>
        <p>
          <strong>Si ingresás con Google o con Apple.</strong> Esos servicios
          nos informan tu nombre y tu correo (Google, además, la dirección de tu
          foto de perfil). Nunca recibimos tu contraseña de Google ni de Apple.
        </p>
        <p>
          <strong>Si comprás en la tienda en línea.</strong> Guardamos los datos
          de entrega que completás (nombre, teléfono y dirección), el detalle
          del pedido y su estado, para prepararlo, entregarlo y emitir el
          comprobante. Los pagos en línea los procesa Mercado Pago: no vemos ni
          almacenamos los datos de tu tarjeta.
        </p>
        <p>
          <strong>Si nos consultás.</strong> Cuando nos escribís por WhatsApp o
          nos pedís una pieza a medida, usamos lo que nos enviás (mensajes,
          imágenes de referencia) solo para responderte y cotizarte. WhatsApp es
          un servicio de terceros con su propia política de privacidad.
        </p>
        <p>
          <strong>Equipo de {name}.</strong> Las cuentas del equipo quedan
          registradas en un historial interno de acciones (por ejemplo, quién
          cambió el estado de un pedido), con fines de control.
        </p>
      </LegalSection>

      <LegalSection title="3. Lo que no hacemos">
        <ul>
          <li>No vendemos ni alquilamos tus datos personales.</li>
          <li>
            No usamos publicidad de terceros, ni herramientas de analítica o de
            seguimiento publicitario, ni en la web ni en la app.
          </li>
          <li>
            La app no accede a tu ubicación, tus contactos, tu cámara, tu
            micrófono ni tus fotos.
          </li>
          <li>
            Solo usamos las cookies necesarias para mantener tu sesión iniciada
            en la web.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Con quién compartimos datos">
        <p>
          Solo con los proveedores que necesitamos para dar el servicio, y
          únicamente lo indispensable para cada tarea:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong>: base de datos y sistema de cuentas.
          </li>
          <li>
            <strong>Vercel</strong>: alojamiento de la tienda web y de los
            servicios que usa la app.
          </li>
          <li>
            <strong>Mercado Pago</strong>: cobro de los pagos en línea.
          </li>
          <li>
            <strong>Resend</strong>: envío de correos del servicio (por ejemplo,
            la confirmación de tu cuenta o de un pedido).
          </li>
          <li>
            <strong>Google y Apple</strong>: solo si elegís ingresar con tu
            cuenta de alguno de ellos.
          </li>
        </ul>
        <p>
          Algunos de estos proveedores almacenan la información en servidores
          ubicados fuera de la Argentina. También podemos entregar datos cuando
          una autoridad competente lo exija por ley.
        </p>
      </LegalSection>

      <LegalSection title="5. Cuánto tiempo los guardamos">
        <p>
          Los datos de tu cuenta se conservan mientras la cuenta exista. Si la
          eliminás, se borran junto con tus direcciones, favoritos, puntos y
          pedidos a medida. Los registros de las compras ya realizadas se
          conservan durante el plazo que exigen las normas fiscales y contables,
          desvinculados de tu cuenta.
        </p>
      </LegalSection>

      <LegalSection title="6. Tus derechos">
        <p>
          Podés pedirnos en cualquier momento acceder a tus datos, corregirlos,
          actualizarlos o eliminarlos, escribiéndonos a los medios de contacto
          de esta página. Respondemos dentro de los plazos de la Ley 25.326.
        </p>
        <p>
          El titular de los datos personales tiene la facultad de ejercer el
          derecho de acceso a los mismos en forma gratuita a intervalos no
          inferiores a seis meses, salvo que se acredite un interés legítimo al
          efecto, conforme lo establecido en el artículo 14, inciso 3 de la Ley
          N.º 25.326. La Agencia de Acceso a la Información Pública, en su
          carácter de Órgano de Control de la Ley N.º 25.326, tiene la
          atribución de atender las denuncias y reclamos que interpongan quienes
          resulten afectados en sus derechos por incumplimiento de las normas
          vigentes en materia de protección de datos personales.
        </p>
      </LegalSection>

      <LegalSection title="7. Cómo eliminar tu cuenta">
        <p>
          Desde la app: <strong>Cuenta → Eliminar mi cuenta</strong>. También
          podés pedirlo sin la app: las instrucciones están en{" "}
          <Link href="/eliminar-cuenta">Eliminar mi cuenta</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Menores de edad">
        <p>
          Nuestros servicios no están dirigidos a menores de 13 años y no
          recopilamos sus datos a sabiendas. Las compras de menores de 18 años
          requieren la autorización de su madre, padre o tutor. Si creés que un
          menor nos dio datos personales, escribinos y los eliminamos.
        </p>
      </LegalSection>

      <LegalSection title="9. Seguridad">
        <p>
          Toda la comunicación con la tienda y con la app viaja cifrada (HTTPS),
          el acceso a los datos está limitado al personal autorizado y cada
          acción sensible del panel de gestión queda registrada. Ningún sistema
          es infalible: si detectamos un incidente que afecte tus datos, te
          vamos a avisar.
        </p>
      </LegalSection>

      <LegalSection title="10. Cambios en esta política">
        <p>
          Si cambiamos la forma en que tratamos tus datos, vamos a actualizar
          esta página y la fecha que figura arriba. Si el cambio es importante,
          lo vamos a avisar en la tienda o en la app.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
