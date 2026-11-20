# Fichas de las tiendas — textos y respuestas listos para copiar

Todo lo de acá describe lo que la app hace de verdad. Si cambia la app (se
agregan pagos, notificaciones, analítica…), hay que actualizar estas respuestas.

Las imágenes están en esta misma carpeta (`store/`): ver "Imágenes" al final.

## Datos comunes

| Dato                     | Valor                                                  |
| ------------------------ | ------------------------------------------------------ |
| Nombre                   | Hefesto 3D                                             |
| Identificador            | `ar.com.hefesto3d.hefesto`                             |
| Categoría                | Compras (Shopping)                                     |
| Precio                   | Gratis                                                 |
| Sitio web                | https://hefesto3d.com.ar                               |
| Política de privacidad   | https://hefesto3d.com.ar/privacidad                    |
| Eliminar cuenta          | https://hefesto3d.com.ar/eliminar-cuenta               |
| Soporte                  | https://hefesto3d.com.ar (WhatsApp y correo en el pie) |
| Contiene anuncios        | No                                                     |
| Compras dentro de la app | No                                                     |

## Textos

**Descripción breve** (Play Store, máx. 80):

> Impresión 3D a pedido: figuras, llaveros y regalos. Consultá por WhatsApp.

**Subtítulo** (App Store, máx. 30):

> Impresión 3D a pedido

**Palabras clave** (App Store, máx. 100):

> impresión 3d,figuras,llaveros,regalos,personalizados,decoración,cosplay,souvenirs,trofeos,3d

**Descripción completa** (las dos tiendas):

> Hefesto 3D es un taller de impresión 3D de Puerto Iguazú, Misiones. En la app
> tenés todo nuestro catálogo: figuras, llaveros, decoración, organizadores,
> piezas de cosplay, souvenirs, trofeos y regalos personalizados.
>
> • Explorá por categoría o buscá lo que necesitás.
> • Filtrá por precio, material y ofertas.
> • Mirá fotos, tamaños, colores y tiempo de producción de cada pieza.
> • Guardá tus favoritos para tenerlos a mano.
> • Consultá o pedí por WhatsApp con un toque: el mensaje ya sale armado con el
> producto, el tamaño y el color que elegiste.
> • Elegí cómo verla: modo oscuro, claro o luz nocturna.
>
> ¿Tenés una idea? También hacemos piezas a medida: escribinos y la diseñamos.
>
> Para el equipo de Hefesto 3D, la app incluye el panel de gestión: ventas,
> producción, stock de filamentos, productos, clientes, descuentos y reportes.
>
> Hacemos envíos a todo el país.

**Novedades de esta versión:**

> Primera versión de la app de Hefesto 3D.

## Play Console → "Contenido de la app"

- **Política de privacidad:** la dirección de arriba.
- **Acceso a la app:** "Todas las funciones están disponibles sin acceso
  especial" para la tienda. Como el panel de gestión requiere cuenta del equipo,
  elegir "Todas o algunas funciones están restringidas" y cargar un usuario de
  prueba del equipo (ver "Cuenta para la revisión").
- **Anuncios:** No contiene anuncios.
- **Clasificación de contenido:** categoría "Otro / Utilidad, productividad,
  comunicación u otros"; todas las respuestas "No" (sin violencia, sin contenido
  sexual, sin lenguaje ofensivo, sin drogas, sin juegos de azar, no comparte
  ubicación, no permite que los usuarios interactúen entre sí, no permite
  comprar bienes digitales).
- **Público objetivo:** 18 años o más. No está dirigida a niños.
- **App de noticias:** No. **App de salud:** No. **App de gobierno:** No.
- **Funciones financieras:** ninguna.
- **ID de publicidad:** la app no usa el ID de publicidad.

### Seguridad de los datos (Data safety)

- ¿La app recopila o comparte datos de los usuarios? **Sí** (recopila; no
  comparte).
- ¿Los datos se cifran en tránsito? **Sí.**
- ¿Los usuarios pueden pedir que se eliminen sus datos? **Sí** → dirección
  `https://hefesto3d.com.ar/eliminar-cuenta`.

Datos recopilados (todos **opcionales**: solo si la persona crea una cuenta;
ninguno "compartido"; propósito: **Funciones de la app** y **Administración de
la cuenta**):

| Categoría            | Dato                            | Se recopila           |
| -------------------- | ------------------------------- | --------------------- |
| Información personal | Nombre                          | Sí                    |
| Información personal | Dirección de correo electrónico | Sí                    |
| Información personal | IDs de usuario                  | Sí                    |
| Información personal | Número de teléfono              | Sí (solo si lo carga) |

Desde la 1.1.0 el panel sube archivos desde el teléfono, así que también se
declaran (recopilados, **opcionales**, propósito **Funciones de la app**, no
compartidos):

| Categoría             | Dato                                                    |
| --------------------- | ------------------------------------------------------- |
| Fotos y videos        | Fotos, Videos                                           |
| Archivos de audio     | Grabaciones de voz o de sonido, Otros archivos de audio |
| Archivos y documentos | Archivos y documentos (PDF)                             |

En App Store Connect el equivalente es "Fotos o vídeos", "Datos de audio" y
"Otro contenido del usuario" (funcionalidad de la app, vinculados a la
identidad, sin seguimiento).

Todo lo demás (ubicación, información financiera, salud, mensajes, calendario,
contactos, actividad en apps, navegación web, información del dispositivo u
otros identificadores, diagnósticos): **No**.

## App Store Connect

- **Clasificación por edad:** 4+ (todas las respuestas "Ninguno/No").
- **Derechos de contenido:** no contiene contenido de terceros que requiera
  derechos… _Ojo:_ si publicás capturas con personajes con marca registrada
  (Mario, Pokémon, etc.), Apple puede objetarlas. Para las capturas de la ficha
  conviene mostrar productos propios (llaveros, organizadores, trofeos).
- **Cifrado:** la app solo usa HTTPS estándar; ya está declarado en la app
  (no hay que responder nada en cada subida).
- **Precio:** gratis, disponible en Argentina (y los países que quieras).

### Privacidad de la app (App Privacy)

"¿Recopilan datos de esta app?" → **Sí**.

| Dato                                         | ¿Vinculado al usuario? | ¿Seguimiento? | Propósito               |
| -------------------------------------------- | ---------------------- | ------------- | ----------------------- |
| Información de contacto → Nombre             | Sí                     | No            | Funcionalidad de la app |
| Información de contacto → Correo electrónico | Sí                     | No            | Funcionalidad de la app |
| Información de contacto → Número de teléfono | Sí                     | No            | Funcionalidad de la app |
| Identificadores → ID de usuario              | Sí                     | No            | Funcionalidad de la app |

Nada más. La app **no** hace seguimiento.

### Notas para la revisión de Apple (copiar en "Notas")

> Hefesto 3D es el catálogo de un taller de impresión 3D. Los productos son
> bienes físicos hechos a pedido: la compra se coordina por WhatsApp (botón
> "Consultar por WhatsApp" en cada producto), no hay pagos dentro de la app.
>
> La tienda completa se usa sin cuenta. La cuenta es opcional. Una cuenta de
> cliente se puede eliminar desde la app: Cuenta → Eliminar mi cuenta.
>
> La app incluye además el panel de gestión para el personal del taller
> (Cuenta → Panel de administración). Para revisarlo, usar la cuenta de prueba
> indicada arriba. Las cuentas del personal las administra el dueño del
> negocio.

## Cuenta para la revisión

Las dos tiendas piden un usuario para probar lo que requiere iniciar sesión.

1. En la web: Panel → Configuración → Equipo → invitar a un correo tuyo (por
   ejemplo `revision@…`) con un rol que pueda **ver** los módulos pero no borrar.
2. Entrar una vez con ese usuario y dejarle una contraseña.
3. Cargar ese correo y contraseña en Play Console (Acceso a la app) y en App
   Store Connect (Información de revisión de la app → Inicio de sesión).

## Imágenes

| Para                                | Archivo                                 | Tamaño    |
| ----------------------------------- | --------------------------------------- | --------- |
| Ícono de Play Store                 | `store/icono-512.png`                   | 512×512   |
| Gráfico de funciones de Play Store  | `store/grafico-1024x500.png`            | 1024×500  |
| Capturas de teléfono (Play Store)   | `store/capturas/android/*.png`          | 1080×1920 |
| Capturas de iPhone 6,3" (App Store) | `store/capturas/iphone-6.3/*.png`       | 1206×2622 |
| Capturas de iPhone 6,9" (reserva)   | `store/capturas/iphone/*.png`           | 1320×2868 |
| Ícono de App Store                  | va dentro de la app (no se sube aparte) | —         |

App Store Connect (2026) pide las capturas del "iPhone con Dynamic Island
(pantalla mediana)": 6,1" o 6,3", o sea 1179×2556 o 1206×2622. Las de 6,9"
las rechaza por tamaño; las de `iphone-6.3/` son las mismas, achicadas y sin
canal alfa (2026-11-14).

## Estado de la publicación (2026-11-14)

**App Store** — app creada (Apple ID 6834978841), solo Argentina, gratis,
clasificación 4+, versión 1.0.0 con la compilación 6 de Codemagic, ficha,
capturas, notas para la revisión y respuestas de privacidad cargadas. Para
enviarla falta lo que solo puede hacer el titular de la cuenta:

1. Información de la app → Derechos sobre el contenido → "No, no contiene,
   muestra ni accede a contenido de terceros" → Aceptar → Guardar.
2. Privacidad de la app → **Publicar** (las respuestas ya están cargadas).
3. Versión 1.0.0 → Información para el equipo de revisión → nombre,
   apellido, teléfono y correo de contacto → Guardar.
4. **Añadir a revisión** → **Enviar a revisión**. Con "Publicar esta versión
   automáticamente", sale en la tienda apenas Apple la aprueba.

**Google Play** — Google exige una **prueba cerrada** (12 personas durante 14
días) antes de habilitar producción en esta app; no se puede saltear. Ya están
cargados: política de privacidad, anuncios (no), ID de publicidad (no), apps
gubernamentales (no), funciones financieras (ninguna), salud (ninguna),
categoría Compras, contacto (correo del taller y web), seguridad de los datos
(borrador) y la ficha con ícono, gráfico y 5 capturas (borrador). Falta:

1. Datos de inicio de sesión (decidir la cuenta para la revisión, ver abajo).
2. Clasificación de contenido: correo de contacto, categoría "Todos los demás
   tipos de aplicaciones" y "No" en todo. Al enviarlo se aceptan los términos
   de la IARC.
3. Contenido y audiencia objetivo: 18 años o más.
4. Seguridad de los datos → Guardar (queda habilitado después del punto 3).
5. Estado de operador (UE): declarar si sos comerciante.
6. Ficha de Play Store → "Declaración de recursos de IA" (si el logo o las
   fotos de productos de las capturas se hicieron con IA, etiquetarlos) →
   Guardar.
7. Probar y publicar → Prueba cerrada → crear la versión, subir
   `build/app/outputs/bundle/release/app-release.aab` (pesa 63 MB: se
   arrastra a mano), cargar al menos 12 correos de testers y publicar en
   la prueba. A los 14 días: Panel de control → Solicitar acceso a producción.
