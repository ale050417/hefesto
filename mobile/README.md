# Hefesto 3D — app para Android y iPhone

App Flutter de Hefesto 3D: la **tienda** (inicio, catálogo, producto, favoritos,
cuenta) y el **panel de gestión** completo para el equipo. Usa la misma base y
las mismas reglas que la web: habla con `https://hefesto3d.com.ar/api/v1`
(código en `../src/app/api/v1`), así que lo que se cambia en la app se ve en la
web y al revés.

- Identificador de la app: `ar.com.hefesto3d.hefesto` (Android e iOS).
- Flutter 3.44.8 · solo teléfono en vertical · solo en castellano.

## Correr en la PC

```bash
flutter pub get
flutter run                      # emulador de Android contra la web local (pnpm dev en la carpeta de arriba)
flutter run --dart-define=API_BASE_URL=https://hefesto3d.com.ar   # contra producción
```

En modo debug la app busca la web en `http://10.0.2.2:3000` (la PC vista desde
el emulador). La versión publicada usa siempre producción.

## Pruebas

```bash
flutter analyze
flutter test
SHOT_DIR=C:/capturas flutter test     # además guarda una captura PNG de cada pantalla y modal
```

Los tests `test/phone_*_test.dart` dibujan cada pantalla en un teléfono chico
(360×640) y en un iPhone con notch, abren **cada modal**, abren el teclado y
prueban letra grande y los tres modos de color (ver
`test/support/device_kit.dart`). Si algo se desborda, queda tapado por el
teclado o por las barras del sistema, el test falla.

Reglas para que no se rompa nada al agregar pantallas:

- Toda hoja inferior se abre con `showAppSheet` y arma su contenido con
  `SheetBody` (`lib/core/widgets/modals.dart`).
- Fechas con `pickDay`, horas con `pickTime` (mismo archivo).
- Un diálogo con campos de texto lleva `scrollable: true`.
- Los colores y formas de botones, interruptores, diálogos y menús salen del
  tema (`lib/core/theme/app_theme.dart`): no se pisan por pantalla.
- Fotos del teléfono: `PhotoPickerField` (`lib/core/widgets/photo_picker.dart`);
  audios y archivos: `AttachmentPickerField` (`lib/core/widgets/file_attach.dart`).
  En los tests se reemplazan con `photoSourceProvider` / `attachmentSourceProvider`
  (`test/support/photo_kit.dart`), y las fotos con dirección real se apagan con
  `mockImageCachePlugins()` para que las capturas no dependan de la red.

## Subir una versión nueva

1. Cambiar `version:` en `pubspec.yaml` (ej. `1.0.1+2`: versión visible + número
   de compilación, que **siempre** tiene que subir) y `appVersion` en
   `lib/core/config.dart`.
2. Android: ver "Android" abajo. iPhone: ver "iPhone" abajo.

## Android (Play Store)

La clave de subida ya está creada:

- Archivo: `C:\Users\alexe\hefesto-upload.jks`
- Datos (contraseña y alias): `android/key.properties`

**Guardá una copia de los dos fuera de la PC** (Drive, pendrive). Ninguno se
sube al repositorio. Si se pierden, hay que pedirle a Google que reinicie la
clave de subida.

```bash
flutter build appbundle --release
```

El archivo para subir queda en
`build/app/outputs/bundle/release/app-release.aab`.

En [Play Console](https://play.google.com/console):

1. **Crear app** → nombre "Hefesto 3D", idioma español (Latinoamérica), tipo
   App, gratis.
2. **Prueba interna** → crear versión → subir el `.aab` → aceptar "Firma de apps
   de Play". Con eso ya se puede instalar desde el link de prueba.
3. Completar lo que pide el panel "Configurar tu app" (los textos y respuestas
   están en `store/ficha.md`).
4. **Producción** → crear versión con el mismo `.aab` → enviar a revisión.

> Para esta app Google exige antes una **prueba cerrada** con 12 personas
> durante 14 días (confirmado en el Panel de control, 2026-11-14). Después se
> pide el acceso a producción desde el mismo panel. Lo que ya está cargado y lo
> que falta: `store/ficha.md` → "Estado de la publicación".

## iPhone (App Store) con Codemagic

iOS solo se compila en una Mac. [Codemagic](https://codemagic.io) presta una en
la nube y sigue las instrucciones de `../codemagic.yaml`.

Ya está hecho (2026-11-14):

- La app `hefesto` está agregada en Codemagic (repositorio `ale050417/hefesto`).
- El identificador `ar.com.hefesto3d.hefesto` está registrado en la cuenta de
  Apple con **Sign In with Apple**, y su perfil de App Store ("Hefesto 3D App
  Store") está creado y cargado en Codemagic como `hefesto_appstore`, con el
  mismo certificado de distribución que Fadely. Lo hizo el workflow
  "Hefesto 3D · iOS · alta de la firma (una sola vez)"; no hace falta volver a
  correrlo.

- La app "Hefesto 3D" existe en App Store Connect (Apple ID 6834978841) con la
  ficha completa; lo que falta para el primer envío está en
  `store/ficha.md` → "Estado de la publicación".

Cada vez que quieras publicar: Codemagic → `hefesto` → **Start new build** →
workflow "Hefesto 3D · iOS" → rama `master`. Revisa la app (analizador y
pruebas), la compila, la firma y la sube a App Store Connect (no la manda a
la prueba de TestFlight). Para mandarla a la tienda: App Store Connect → la
app → versión nueva → elegir la compilación → **Añadir a revisión** →
**Enviar a revisión**.

> Aviso de Apple al subir (2026-11-14): desde abril de 2027 las apps tienen
> que apuntar a iOS 15 o más. Hoy el proyecto apunta a iOS 13: antes de esa
> fecha hay que subir `IPHONEOS_DEPLOYMENT_TARGET` (y la plataforma del
> Podfile) a 15.0 y probar la compilación.

Si algún día la compilación falla en "Perfiles de firma" con _No matching
profiles found_, el perfil venció o se borró: correr de nuevo el workflow de
alta y volver a traer el perfil (Codemagic → Settings → Code signing
identities → iOS provisioning profiles → Fetch profiles).

## Configuración de Supabase que la app necesita

Ya está hecha (2026-11-14). Para referencia, en el panel de Supabase del
proyecto (Authentication):

1. **URL Configuration → Redirect URLs**: agregar
   `ar.com.hefesto3d.hefesto://login-callback`. La usan el ingreso con Google y
   el link de "recuperar contraseña" para volver a la app. Sin esto, Google
   termina en la web en vez de la app.
2. **Providers → Apple**: habilitarlo y poner `ar.com.hefesto3d.hefesto` en
   "Client IDs". Mientras esté apagado, la app de iPhone no muestra ni el botón
   de Apple ni el de Google (Apple exige ofrecer el suyo si hay otro), y se
   ingresa con email y contraseña. Al habilitarlo, los botones aparecen solos,
   sin publicar otra versión.

## Qué piden las tiendas (ya resuelto)

- Política de privacidad: <https://hefesto3d.com.ar/privacidad> (enlazada
  también desde la app, en Cuenta).
- Baja de la cuenta: dentro de la app (Cuenta → Eliminar mi cuenta) y por la web
  en <https://hefesto3d.com.ar/eliminar-cuenta>.
- La app no usa publicidad, analítica ni rastreadores, y no pide ubicación,
  contactos ni notificaciones. Lo único que pide (y solo al equipo, en el
  panel) es la cámara o las fotos al adjuntar una foto a un arreglo o a una
  consulta: en iPhone con los textos de `ios/Runner/Info.plist`; en Android
  no hace falta ningún permiso (se usa el selector de fotos del sistema).
  Los audios, videos y PDF de una consulta se eligen con el selector de
  archivos del sistema, que no pide permisos en ninguno de los dos.
