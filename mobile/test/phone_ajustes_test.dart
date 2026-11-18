// Pruebas "teléfono real" del grupo Ajustes: Configuración (menú, negocio,
// tienda, banner, envíos, pagos, equipo, invitar, roles, textos) y Auditoría
// (lista y detalle). (2026-11-14, pedido de Ale: "que las pantallas no estén
// rotas, que cuando tocás los botones se vean bien los modales".)
//
// Cada pantalla, formulario y modal se dibuja en el teléfono más chico
// (360×640 con barra de tres botones) y en un iPhone con notch, con letra
// normal y con letra grande (1,3×), con el teclado abierto donde hay campos y
// con datos extremos (nombres larguísimos, listas de 30+, montos de 9 cifras,
// todo vacío). Con SHOT_DIR=carpeta guarda una captura de cada estado.

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/auditoria/audit_detail_screen.dart';
import 'package:hefesto/features/admin/auditoria/audit_labels.dart';
import 'package:hefesto/features/admin/auditoria/audit_models.dart';
import 'package:hefesto/features/admin/auditoria/audit_providers.dart';
import 'package:hefesto/features/admin/auditoria/auditoria_screen.dart';
import 'package:hefesto/features/admin/configuracion/banner_edit_screen.dart';
import 'package:hefesto/features/admin/configuracion/config_api.dart';
import 'package:hefesto/features/admin/configuracion/config_models.dart';
import 'package:hefesto/features/admin/configuracion/config_widgets.dart';
import 'package:hefesto/features/admin/configuracion/configuracion_screen.dart';
import 'package:hefesto/features/admin/configuracion/envios_screen.dart';
import 'package:hefesto/features/admin/configuracion/equipo_screen.dart';
import 'package:hefesto/features/admin/configuracion/invite_screen.dart';
import 'package:hefesto/features/admin/configuracion/negocio_screen.dart';
import 'package:hefesto/features/admin/configuracion/pagos_screen.dart';
import 'package:hefesto/features/admin/configuracion/role_edit_screen.dart';
import 'package:hefesto/features/admin/configuracion/textos_editors.dart';
import 'package:hefesto/features/admin/configuracion/textos_screen.dart';
import 'package:hefesto/features/admin/configuracion/tienda_screen.dart';

import 'admin_configuracion_fixtures.dart';
import 'support/device_kit.dart';
import 'support/photo_kit.dart';

// ---------------------------------------------------------------------------
// Casos: teléfono + tamaño de letra
// ---------------------------------------------------------------------------

class _Case {
  const _Case(this.phone, [this.scale = 1]);
  final Phone phone;
  final double scale;

  /// Sufijo del nombre de la captura.
  String get tag => scale == 1 ? '' : '_grande';
  String get label => '${phone.name}${scale == 1 ? '' : ' con letra 1,3×'}';
}

/// Lo obligatorio: el más chico, el iPhone con notch y el chico con letra grande.
const _cases = [_Case(Phone.small), _Case(Phone.iphone), _Case(Phone.small, 1.3)];

// ---------------------------------------------------------------------------
// Datos de ejemplo
// ---------------------------------------------------------------------------

String _rep(String s, int length) => (s * (length ~/ s.length + 1)).substring(0, length);

const _longWord = 'Impresiones tridimensionales Hefesto del Litoral Argentino Sociedad de Responsabilidad Limitada';

const _uuid = '9f1c2d3e-0000-4000-8000-00000000';

/// Los 15 módulos reales del panel (src/core/auth/perm-defs.ts).
const _modules = [
  ('productos', 'Productos y categorías'),
  ('pedidos', 'Pedidos'),
  ('medida', 'Pedidos a medida'),
  ('clientes', 'Clientes'),
  ('produccion', 'Cola de producción'),
  ('filamentos', 'Filamentos'),
  ('fallas', 'Impresiones fallidas'),
  ('descuentos', 'Descuentos'),
  ('recompensas', 'Recompensas'),
  ('resenas', 'Reseñas'),
  ('reportes', 'Reportes'),
  ('ganancias', 'Ganancias y socios'),
  ('calculadora', 'Calculadora'),
  ('config', 'Configuración'),
  ('auditoria', 'Auditoría'),
];

/// Las temporadas reales (src/features/settings/seasons.ts).
const _seasons = [
  ('none', 'Marca Hefesto', 'Tu identidad dorada de siempre', '#C9A84C', false),
  ('navidad', 'Navidad', 'Rojo y verde + nieve cayendo', '#D7263D', true),
  ('anionuevo', 'Año Nuevo', 'Dorado brillante + destellos', '#C9A84C', true),
  ('reyes', 'Reyes Magos', 'Violeta real + destellos dorados', '#7B4DB3', true),
  ('sanvalentin', 'San Valentín', 'Rojo pasión + corazones', '#E63956', true),
  ('otonio', 'Otoño', 'Naranjas terrosos + hojas', '#C26B27', true),
  ('invierno', 'Invierno', 'Azules fríos + nieve', '#3E7CB1', true),
  ('primavera', 'Primavera', 'Rosados suaves + pétalos', '#E29ABF', true),
  ('verano', 'Verano', 'Amarillos cálidos + sol', '#E0A82E', true),
  ('halloween', 'Halloween', 'Naranja calabaza + murciélagos', '#E8741E', true),
  ('patrias', 'Fiestas Patrias', 'Celeste y blanco + destellos', '#6CA9DC', true),
  ('blackfriday', 'Black Friday', 'Negro y dorado · alto impacto', '#E0A82E', true),
];

/// Las secciones reales del inicio (src/features/settings/home-sections.ts).
const _homeSections = [
  ('trustBar', 'Banda de confianza'),
  ('categorias', 'Categorías'),
  ('nuevos', 'Nuevos lanzamientos'),
  ('stats', 'Hefesto en números'),
  ('ofertas', 'Ofertas de la semana'),
  ('materiales', 'Materiales'),
  ('masVendidos', 'Más vendidos'),
  ('comoFunciona', '¿Cómo funciona?'),
  ('galeria', 'Galería de Instagram'),
  ('faq', 'Preguntas frecuentes'),
  ('pedidoMedida', 'Pedido a medida'),
];

/// Configuración con todo al límite de lo que acepta el servidor.
Map<String, dynamic> _bigConfigJson() => {
      'negocio': {
        'storeName': _rep(_longWord, 120),
        'slogan': _rep('Forjado en capas, pieza por pieza, con paciencia y buen filamento. ', 120),
        'description': _rep('Imprimimos figuras, llaveros, mates y repuestos a pedido en Puerto Iguazú. ', 500),
        'whatsapp': '+54 9 3757 624148 (solo mensajes, de 9 a 20)',
        'contactEmail': 'contacto.ventas.mayoristas.y.minoristas@impresiones-hefesto-del-litoral.com.ar',
        'addressText': _rep('Av. Victoria Aguirre 320, local 4, galería del centro, Puerto Iguazú, Misiones. ', 200),
        'instagram': '@hefesto3d.impresiones.del.litoral.argentino',
        'tiktok': '@hefesto3d.impresiones.del.litoral.argentino',
        'cuit': '30-71845512-3',
        'hours': [
          for (final l in ['Lunes a viernes (menos los feriados)', 'Sábados', 'Domingos y feriados nacionales', 'Vísperas de fiestas', 'Vacaciones de invierno'])
            {
              'label': l,
              'morning': {'on': true, 'from': '09:00', 'to': '13:00'},
              'afternoon': {'on': l != 'Sábados', 'from': '16:30', 'to': '20:30'},
            },
        ],
      },
      'envios': {
        'city': 'Puerto Iguazú y alrededores (Misiones, Argentina)',
        'freeOver': 123456789,
        'outMsg': _rep('Coordinamos el envío por WhatsApp; el costo del flete queda a cargo del comprador. ', 500),
        'zones': [
          for (var i = 1; i <= 35; i++)
            {
              'name': i.isEven ? 'Barrio $i' : 'Barrio Villa Nueva de las Dos Mil Hectáreas, sector $i',
              'price': i == 3 ? 123456789 : 1500.5 * i,
            },
        ],
        'pickupEnabled': true,
        'deliveryEnabled': true,
      },
      'pagos': {
        'transferEnabled': true,
        'transferAlias': 'impresiones.hefesto.del.litoral.argentino.cuenta.corriente',
        'transferCbu': '0000003100012345678901',
        'mpEnabled': true,
        'mpNote': _rep('Hasta 12 cuotas con las tarjetas de los bancos adheridos. ', 200),
        'mpConnected': true,
        'cashEnabled': true,
        'cashNote': _rep('Solo al retirar en el taller, con cambio justo. ', 200),
      },
      'tienda': {
        'businessMode': 'vidriera',
        'accentColor': '#7b4db3',
        'season': 'blackfriday',
        'seasonDeco': true,
        'seasonIntensity': 26,
        'seasonDurationSec': 20,
        'bannerIntervalSec': 12,
        'logoUrl': null,
        'heroImageUrl': null,
        'homeSections': [
          for (final (i, s) in _homeSections.indexed) {'id': s.$1, 'label': s.$2, 'on': i.isEven},
        ],
        'seasons': [
          for (final s in _seasons) {'key': s.$1, 'label': s.$2, 'hint': s.$3, 'accent': s.$4, 'hasDeco': s.$5},
        ],
        'banners': [
          for (var i = 1; i <= 12; i++)
            {
              'id': '${_uuid}b${i.toString().padLeft(3, '0')}',
              'title': i.isEven ? 'Promo $i' : _rep('Figuras de colección pintadas a mano, edición limitada número $i. ', 120),
              'subtitle': i.isEven ? null : _rep('Llevá tres y pagá dos durante todo el mes. ', 200),
              'imageUrl': null,
              'position': '50% 50%',
              'align': ['left', 'center', 'right'][i % 3],
              'ctaText': 'Ver todos los productos de la promoción ahora',
              'ctaHref': '/productos?categoria=figuras-de-coleccion&orden=mas-vendidos',
              'isActive': i % 3 != 0,
              'sortOrder': i,
            },
        ],
      },
      'textos': {
        'trustBar': [
          for (final ic in ['truck', 'shield', 'layers', 'refresh'])
            {
              'ic': ic,
              't': _rep('Producción en 48 horas hábiles para todo el país. ', 60),
              'd': _rep('Imprimimos, revisamos pieza por pieza y despachamos rápido. ', 140),
            },
        ],
        'trustBarCustom': true,
        'faq': [
          for (var i = 1; i <= 12; i++)
            {
              'q': _rep('¿Cuánto tarda mi pedido número $i si lo encargo un viernes a la tarde? ', 140),
              'a': _rep('Todo se imprime a pedido, así que el tiempo depende de la pieza: el estimado figura en cada producto. ', 600),
            },
        ],
        'faqCustom': true,
        'quote': {
          'title': _rep('COTIZACIÓN — IMPRESIONES HEFESTO DEL LITORAL ARGENTINO ', 80),
          'depositPct': 100,
          'depositText': _rep('La seña es necesaria para confirmar el encargo y comenzar con el trabajo. ', 300),
          'notes': [
            for (var i = 1; i <= 10; i++)
              _rep('Las dimensiones y el precio indicados corresponden a la cotización $i y pueden variar. ', 600),
          ],
        },
      },
    };

/// Equipo grande: 32 personas y 34 roles con nombres al límite.
Map<String, dynamic> _bigTeamJson({bool canManage = true}) => {
      'canManage': canManage,
      'team': [
        for (var i = 1; i <= 32; i++)
          {
            'id': '${_uuid}u${i.toString().padLeft(3, '0')}',
            'fullName': i % 5 == 0 ? null : (i.isEven ? 'Persona $i' : 'María de los Ángeles Fernández de la Cruz y Álvarez $i'),
            'email': i % 7 == 0 ? null : 'persona.numero.$i.con.un.mail.larguisimo@impresiones-hefesto.com.ar',
            'role': i == 1 ? 'admin' : 'operator',
            'roleId': i % 6 == 0 ? null : '${_uuid}r${(i % 34 + 1).toString().padLeft(3, '0')}',
            'roleName': i % 6 == 0 ? null : (i == 1 ? 'Administrador' : 'Atención al cliente y despacho de pedidos del turno tarde $i'),
            'status': i % 4 == 0 ? 'invitado' : 'activo',
            'isSelf': i == 1,
            'isLastAdmin': i == 1,
          },
      ],
      'roles': [
        for (var i = 1; i <= 34; i++)
          {
            'id': '${_uuid}r${i.toString().padLeft(3, '0')}',
            'name': i == 1 ? 'Administrador' : (i.isEven ? 'Rol $i' : _rep('Atención al cliente y despacho de pedidos del turno tarde $i ', 60)),
            'isSystem': i <= 2,
            'isAdmin': i == 1,
            'permissions': i == 1
                ? <String, dynamic>{}
                : {
                    for (final (j, m) in _modules.indexed)
                      if ((i + j) % 3 != 0) m.$1: ['ver', if (j.isEven) 'crear', 'editar', if (j % 3 == 0) 'eliminar'],
                  },
            'memberCount': i == 1 ? 1 : i * 3,
          },
      ],
      'modules': [
        for (final m in _modules) {'key': m.$1, 'label': m.$2},
      ],
    };

final _config = AdminConfig.fromJson(configJson());
final _bigConfig = AdminConfig.fromJson(_bigConfigJson());
final _emptyConfig = AdminConfig.fromJson(const {});
final _team = TeamData.fromJson(teamJson());
final _bigTeam = TeamData.fromJson(_bigTeamJson());

/// Usuario que puede todo en Configuración (y editar la cotización).
MeInfo get _owner => staffWith(['config', 'productos', 'pedidos', 'auditoria']);

/// Operador que solo puede VER la configuración.
MeInfo get _viewer => staffWith(['config', 'auditoria'], role: 'operator', actions: ['ver']);

/// Operador sin ningún permiso de este grupo.
MeInfo get _outsider => staffWith(['pedidos'], role: 'operator');

/// Doble del cliente de Configuración: anota las llamadas, puede fallar o
/// quedarse esperando (para ver el estado "guardando").
class _Api extends ConfigApi {
  _Api({this.failWith, this.hang = false}) : super(ApiClient());
  String? failWith;
  bool hang;
  final calls = <(String, Object?)>[];

  Future<T> _rec<T>(String name, Object? args, T value) async {
    calls.add((name, args));
    if (hang) return Completer<T>().future;
    if (failWith != null) throw ApiException('invalid', failWith!);
    return value;
  }

  @override
  Future<void> saveNegocio(Map<String, dynamic> body) => _rec('negocio', body, null);
  @override
  Future<void> saveEnvios(Map<String, dynamic> body) => _rec('envios', body, null);
  @override
  Future<void> savePagos(Map<String, dynamic> body) => _rec('pagos', body, null);
  @override
  Future<void> connectMercadoPago(String token) => _rec('mp_connect', token, null);
  @override
  Future<void> disconnectMercadoPago() => _rec('mp_disconnect', null, null);
  @override
  Future<void> saveTienda(Map<String, dynamic> body) => _rec('tienda', body, null);
  @override
  Future<void> saveTextos(Map<String, dynamic> body) => _rec('textos', body, null);
  @override
  Future<void> saveCotizacion(Map<String, dynamic> body) => _rec('cotizacion', body, null);
  @override
  Future<void> updateBanner(String id, Map<String, dynamic> body) => _rec('banner:$id', body, null);
  @override
  Future<void> deleteBanner(String id) => _rec('banner_delete', id, null);
  @override
  Future<String> createBanner(Map<String, dynamic> body) => _rec('banner_create', body, 'b-nuevo');
  @override
  Future<String> uploadImage(PickedPhoto photo, String kind) => _rec(
        'image',
        {'kind': kind, 'filename': photo.filename},
        'https://abc.supabase.co/storage/v1/object/public/products/banners/banner-1.webp',
      );
  @override
  Future<Map<String, dynamic>> invite({
    required String email,
    required String roleId,
    String fullName = '',
    String message = '',
  }) =>
      _rec('invite', {'email': email, 'roleId': roleId, 'fullName': fullName, 'message': message},
          <String, dynamic>{'ok': true, 'email': email, 'promoted': false});
  @override
  Future<Map<String, dynamic>> resendInvite(String userId) =>
      _rec('resend', userId, <String, dynamic>{'ok': true, 'email': 'anto@x.com'});
  @override
  Future<void> assignRole(String userId, String roleId) => _rec('assign', (userId, roleId), null);
  @override
  Future<void> removeMember(String userId) => _rec('remove', userId, null);
  @override
  Future<void> createRole(String name, Map<String, List<String>> permissions) =>
      _rec('role_create', {'name': name, 'permissions': permissions}, null);
  @override
  Future<void> updateRole(String id, String name, Map<String, List<String>> permissions) =>
      _rec('role_update', {'id': id, 'name': name, 'permissions': permissions}, null);
  @override
  Future<void> deleteRole(String id) => _rec('role_delete', id, null);
}

/// Dibuja una pantalla de Configuración en el teléfono del caso.
Future<void> _pumpCfg(
  WidgetTester tester,
  Widget screen,
  _Case c, {
  HefestoThemeMode theme = HefestoThemeMode.dark,
  MeInfo? me,
  _Api? api,
  AdminConfig? config,
  TeamData? team,

  /// Reemplazan a [config] / [team] cuando la carga tiene que fallar o colgarse
  /// (Riverpod no deja pisar dos veces el mismo provider).
  Override? configOverride,
  Override? teamOverride,

  /// De dónde salen las fotos (galería / cámara de mentira).
  PhotoSource? photos,
}) =>
    pumpPhone(
      tester,
      screen,
      phone: c.phone,
      textScale: c.scale,
      theme: theme,
      me: me ?? _owner,
      overrides: [
        configOverride ?? adminConfigProvider.overrideWith((ref) async => config ?? _config),
        teamOverride ?? adminTeamProvider.overrideWith((ref) async => team ?? _team),
        configApiProvider.overrideWithValue(api ?? _Api()),
        photoSourceProvider.overrideWithValue(photos ?? FakePhotoSource()),
      ],
    );

/// Página con un botón que abre [screen] encima (para probar "atrás" con
/// cambios sin guardar y las pantallas que se cierran solas al terminar).
class _Opener extends StatelessWidget {
  const _Opener(this.screen);
  final Widget screen;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Center(
          child: FilledButton(
            key: const Key('abrir'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen)),
            child: const Text('abrir'),
          ),
        ),
      );
}

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('abrir')));
  await settle(tester, 9);
}

// ---------------------------------------------------------------------------
// Buscadores y verificaciones
// ---------------------------------------------------------------------------

/// El campo de texto de un [ConfigField] por su etiqueta.
Finder _field(String label) => find.descendant(
      of: find.byWidgetPredicate((w) => w is ConfigField && w.label == label),
      matching: find.byType(TextFormField),
    );

Finder _gold(String label) => find.widgetWithText(GoldButton, label);

/// La lista vertical principal cuando la pantalla tiene otros desplazables
/// antes (un campo de búsqueda, chips horizontales, pestañas).
Finder _lastList() =>
    find.descendant(of: find.byType(ListView).last, matching: find.byType(Scrollable)).first;

/// En cuántas líneas quedó un texto.
int _lines(WidgetTester tester, Finder text) {
  final p = tester.renderObject<RenderParagraph>(
    find.descendant(of: text, matching: find.byType(RichText)).first,
  );
  return (p.size.height / p.preferredLineHeight).round();
}

/// Abre el teclado en [field] y verifica lo que pide el encargo: el campo
/// queda a la vista y el botón principal sigue alcanzable.
Future<void> _typeIn(WidgetTester tester, Finder field, {String save = 'Guardar cambios'}) async {
  await openKeyboard(tester, field);
  expectFocusedFieldVisible(tester);
  expectReachable(tester, _gold(save), what: 'el botón "$save" con el teclado abierto');
}

/// El cursor del campo con foco tiene que verse: dentro de su propio campo,
/// dentro de la zona desplazable de la pantalla y arriba del teclado.
void _expectCaretVisible(WidgetTester tester, {Finder? viewport}) {
  final focused = find.byWidgetPredicate((w) => w is EditableText && w.focusNode.hasFocus);
  expect(focused, findsOneWidget, reason: 'tendría que haber un campo con el foco');
  final state = tester.state<EditableTextState>(focused);
  final render = state.renderEditable;
  final local = render.getLocalRectForCaret(state.textEditingValue.selection.extent);
  final caret = MatrixUtils.transformRect(render.getTransformTo(null), local);
  final fieldRect = tester.getRect(focused);
  final zone = viewport == null ? safeRect : safeRect.intersect(tester.getRect(viewport));
  expect(
    caret.top >= zone.top - 0.5 && caret.bottom <= zone.bottom + 0.5,
    isTrue,
    reason: 'el cursor ($caret) no está en la zona visible ($zone) de ${currentPhone.name}',
  );
  expect(
    caret.top >= fieldRect.top - 0.5 && caret.bottom <= fieldRect.bottom + 0.5,
    isTrue,
    reason: 'el cursor ($caret) quedó fuera de su campo ($fieldRect)',
  );
}

/// Toca fuera del modal (arriba a la izquierda, sobre la barrera) para cerrarlo.
Future<void> _tapOutside(WidgetTester tester) async {
  await tester.tapAt(Offset(4, currentPhone.top + 6));
  await settle(tester, 5);
}

/// El modal abierto no se mete debajo de la barra de estado ni de la de gestos.
void _expectInsideScreen(WidgetTester tester, Finder modal, String what) {
  final r = tester.getRect(modal);
  expect(r.top >= currentPhone.top - 0.5, isTrue,
      reason: '$what se mete debajo de la barra de estado (arranca en ${r.top})');
  expect(r.bottom <= currentPhone.height + 0.5, isTrue, reason: '$what se sale por abajo (${r.bottom})');
}

// ---------------------------------------------------------------------------
// Auditoría: datos de ejemplo
// ---------------------------------------------------------------------------

final _now = DateTime.now();
DateTime _ago(int days, int hour, [int minute = 0]) =>
    DateTime(_now.year, _now.month, _now.day, hour, minute).subtract(Duration(days: days));

Map<String, dynamic> _ev(
  String id,
  String action,
  DateTime at, {
  String? entity,
  String? entityId,
  Object? meta,
  Map<String, dynamic>? actor = const {'id': 'u1', 'name': 'Ale', 'role': 'admin'},
}) =>
    {
      'id': id,
      'action': action,
      'actionLabel': null,
      'entityType': entity,
      'entityId': entity == null ? null : (entityId ?? 'ent-$id'),
      'metadata': meta,
      'createdAt': at.toUtc().toIso8601String(),
      'actor': actor,
    };

/// Opciones de filtro "de un negocio con años de uso": todas las acciones,
/// todos los tipos y 32 personas (con nombres largos y sin nombre).
Map<String, dynamic> _bigFacets() => {
      'actions': [
        for (final (i, code) in auditActionLabels.keys.indexed) {'value': code, 'label': null, 'count': 400 - i},
        {'value': 'algo.nuevo_sin_traducir', 'label': 'Algo: nuevo sin traducir', 'count': 1},
      ],
      'entityTypes': [
        for (final (i, e) in auditEntityLabels.keys.indexed) {'value': e, 'count': 900 - i},
        {'value': 'tipo_que_la_app_no_conoce', 'count': 2},
      ],
      'actors': [
        for (var i = 1; i <= 31; i++)
          {
            'id': '${_uuid}a${i.toString().padLeft(3, '0')}',
            'name': i % 6 == 0 ? null : (i.isEven ? 'Persona $i' : 'María de los Ángeles Fernández de la Cruz $i'),
            'count': 100 - i,
          },
        {'id': 'sistema', 'name': null, 'count': 7},
      ],
    };

Map<String, dynamic> _smallFacets() => {
      'actions': [
        {'value': 'order.status_changed', 'label': 'Cambió estado de pedido', 'count': 12},
        {'value': 'product.deleted', 'label': 'Borró un producto', 'count': 2},
      ],
      'entityTypes': [
        {'value': 'order', 'count': 14},
        {'value': 'manual_sale', 'count': 3},
        {'value': 'product', 'count': 5},
        {'value': 'team', 'count': 1},
      ],
      'actors': [
        {'id': 'u1', 'name': 'Ale', 'count': 15},
        {'id': 'u9', 'name': null, 'count': 1},
        {'id': 'sistema', 'name': null, 'count': 2},
      ],
    };

/// Un detalle largo y anidado, como el que guarda la edición de un producto.
Map<String, dynamic> _hugeMeta() => {
      'name': _rep('Mate Mario Bros edición de colección pintado a mano con base luminosa ', 160),
      'total': 123456789,
      'customer': 'María de los Ángeles Fernández de la Cruz y Álvarez de Toledo',
      'status': 'in_production',
      'orderNumber': 'HF-000042',
      'reason': _rep('El cliente pidió cambiar el color de la base y el tamaño de la figura. ', 400),
      'sinEspacios': _rep('abcdefghijklmnopqrstuvwxyz0123456789', 180),
      'roleId': '${_uuid}r001',
      'before': {
        'price': 15000,
        'variants': [
          for (var i = 0; i < 6; i++) {'sku': 'MATE-MARIO-ROJO-GRANDE-$i', 'stock': i, 'activo': i.isEven},
        ],
      },
      'after': {
        'price': 18500.75,
        'tags': ['mate', 'mario', 'coleccion', 'pintado-a-mano', 'edicion-limitada'],
        'descripcion': _rep('Texto largo de la descripción nueva del producto. ', 700),
      },
      'vacio': '',
      'nulo': null,
      'activo': true,
    };

AuditPage _page({bool hasMore = false, int n = 1, bool bigFacets = false}) => AuditPage.fromJson({
      'items': [
        _ev('${_uuid}e001', 'order.status_changed', _ago(0, 0, 5),
            entity: 'order', meta: {'orderNumber': 'HF-0042', 'status': 'in_production'}),
        _ev('${_uuid}e002', 'manual_sale.created', _ago(0, 0, 1),
            entity: 'manual_sale', meta: {'total': 123456789, 'customer': 'Feria'}),
        _ev('${_uuid}e003', 'product.updated', _ago(1, 18, 30),
            entity: 'product', entityId: '${_uuid}p003', meta: _hugeMeta()),
        _ev('${_uuid}e004', 'inventory.order_deduct_failed', _ago(1, 9),
            entity: 'order', actor: null, meta: {'orderNumber': 'HF-0040'}),
        _ev('${_uuid}e005', 'team.member_invited', _ago(3, 11),
            entity: 'team',
            entityId: 'persona.con.un.mail.larguisimo@impresiones-hefesto.com.ar',
            meta: {'roleId': '${_uuid}r001'},
            actor: {
              'id': 'u2',
              'name': 'María de los Ángeles Fernández de la Cruz y Álvarez de Toledo',
              'role': 'operator',
            }),
        _ev('${_uuid}e006', 'algo.nuevo_sin_traducir_con_un_codigo_bastante_largo', _ago(6, 8),
            actor: {'id': 'u9', 'name': null, 'role': 'operator'}),
        _ev('${_uuid}e007', 'settings.updated', _ago(6, 7), entity: 'settings', meta: 'texto suelto, no un objeto'),
        // Como la registra el servidor (src/app/api/v1/me/route.ts): sin actor.
        _ev('${_uuid}e008', 'account.deleted', _ago(7, 10),
            entity: 'customer', entityId: '${_uuid}c008', actor: null, meta: {'ordersKept': true}),
      ],
      'page': n,
      'pageSize': 30,
      'hasMore': hasMore,
      if (n == 1) 'facets': bigFacets ? _bigFacets() : _smallFacets(),
    });

/// 60 eventos (dos páginas llenas) para probar la paginación.
AuditPage _fullPage(int page, {required bool hasMore}) => AuditPage.fromJson({
      'items': [
        for (var i = 0; i < 30; i++)
          _ev(
            '${_uuid}f$page${i.toString().padLeft(2, '0')}',
            auditActionLabels.keys.elementAt((page * 7 + i) % auditActionLabels.length),
            _ago(page * 3 + i ~/ 6, 20 - i % 12, i),
            entity: auditEntityLabels.keys.elementAt(i % auditEntityLabels.length),
            meta: i % 4 == 0 ? null : {'name': i.isEven ? 'Llavero $i' : _rep('Figura de colección número $i ', 90)},
            actor: i % 5 == 0 ? null : {'id': 'u${i % 3}', 'name': i % 3 == 0 ? null : 'Persona ${i % 3}', 'role': 'operator'},
          ),
      ],
      'page': page,
      'pageSize': 30,
      'hasMore': hasMore,
      if (page == 1) 'facets': _smallFacets(),
    });

class _FakeAuditApi implements AuditApi {
  _FakeAuditApi({this.pages, this.fail = false, this.hang = false, this.failFromPage, this.hangFromPage});
  final List<AuditPage>? pages;
  bool fail;

  /// Nunca responde (estado "cargando").
  final bool hang;

  /// Desde esta página falla / se queda esperando ("cargar más").
  final int? failFromPage;
  final int? hangFromPage;
  final calls = <(AuditFilters, int, bool)>[];

  @override
  Future<AuditPage> fetch(AuditFilters filters, {int page = 1, bool facets = false}) async {
    calls.add((filters, page, facets));
    if (hang || (hangFromPage != null && page >= hangFromPage!)) return Completer<AuditPage>().future;
    if (fail || (failFromPage != null && page >= failFromPage!)) {
      throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
    }
    final list = pages ?? [_page()];
    return list[(page - 1).clamp(0, list.length - 1)];
  }

  @override
  Future<AuditEntry> detail(String id) async {
    if (fail) throw ApiException('offline', 'No pudimos conectarnos.');
    final all = (pages ?? [_page()]).expand((p) => p.items);
    return all.firstWhere((e) => e.id == id);
  }
}

Future<void> _pumpAudit(
  WidgetTester tester,
  Widget screen,
  _Case c, {
  _FakeAuditApi? api,
  MeInfo? me,
  HefestoThemeMode theme = HefestoThemeMode.dark,
}) =>
    pumpPhone(
      tester,
      screen,
      phone: c.phone,
      textScale: c.scale,
      theme: theme,
      me: me ?? _owner,
      overrides: [auditApiProvider.overrideWithValue(api ?? _FakeAuditApi())],
    );

// ---------------------------------------------------------------------------

void main() {
  setUpAll(setUpDeviceKit);

  // =========================================================================
  group('Configuración · menú', () {
    for (final c in _cases) {
      testWidgets('se ve entero y la última sección queda arriba de la barra del sistema (${c.label})',
          (tester) async {
        await _pumpCfg(tester, const AdminConfiguracionScreen(), c);
        expect(find.text('Datos del negocio'), findsOneWidget);
        await shoot(tester, 'cfg_menu${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Equipo y roles'), what: 'la última sección del menú');
        await shoot(tester, 'cfg_menu_fin${c.tag}');
      });

      testWidgets('con datos larguísimos no se desborda (${c.label})', (tester) async {
        await _pumpCfg(tester, const AdminConfiguracionScreen(), c, config: _bigConfig);
        await shoot(tester, 'cfg_menu_largo${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Equipo y roles'), what: 'la última sección del menú');
      });

      testWidgets('sin datos cargados (todo vacío) igual se ve (${c.label})', (tester) async {
        await _pumpCfg(tester, const AdminConfiguracionScreen(), c, config: _emptyConfig);
        expect(find.text('Tu negocio'), findsOneWidget, reason: 'sin nombre cargado muestra el genérico');
        await shoot(tester, 'cfg_menu_vacio${c.tag}');
        await scrollToEnd(tester);
      });

      testWidgets('solo lectura, sin acceso, error y cargando (${c.label})', (tester) async {
        await _pumpCfg(tester, const AdminConfiguracionScreen(), c, me: _viewer);
        expect(find.text('Tu rol puede ver la configuración, pero no cambiarla.'), findsOneWidget);
        await shoot(tester, 'cfg_menu_solo_ver${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Equipo y roles'), what: 'la última sección del menú');

        await _pumpCfg(tester, const AdminConfiguracionScreen(), c, me: _outsider);
        expect(find.text('Sin acceso'), findsOneWidget);
        expect(find.text('Datos del negocio'), findsNothing);
        await shoot(tester, 'cfg_menu_sin_acceso${c.tag}');

        await _pumpCfg(
          tester,
          const AdminConfiguracionScreen(),
          c,
          configOverride: adminConfigProvider.overrideWith(
            (ref) => throw ApiException(
              'unavailable',
              'No pudimos completar la operación. Probá de nuevo en unos segundos.',
            ),
          ),
        );
        expectReachable(tester, _gold('Reintentar'), what: 'el botón Reintentar');
        await shoot(tester, 'cfg_menu_error${c.tag}');

        await _pumpCfg(
          tester,
          const AdminConfiguracionScreen(),
          c,
          configOverride: adminConfigProvider.overrideWith((ref) => Completer<AdminConfig>().future),
        );
        expect(find.text('Datos del negocio'), findsNothing);
        await shoot(tester, 'cfg_menu_cargando${c.tag}');
      });
    }

    testWidgets('tocar cada sección abre su pantalla', (tester) async {
      const c = _Case(Phone.small);
      for (final (tile, landmark) in [
        ('Datos del negocio', 'Nombre comercial'),
        ('Tienda y apariencia', 'Vidriera digital'),
        ('Envío y retiro', 'Retiro en local'),
        ('Medios de pago', 'Transferencia bancaria'),
        ('Textos clave', 'Banda de confianza'),
        ('Equipo y roles', 'Invitar a alguien'),
      ]) {
        await _pumpCfg(tester, const AdminConfiguracionScreen(), c);
        await tester.scrollUntilVisible(find.text(tile), 120, scrollable: find.byType(Scrollable).first);
        await settle(tester, 2);
        await tester.tap(find.text(tile));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir "$tile"');
        expect(find.text(landmark), findsWidgets, reason: 'al tocar "$tile"');
      }
    });
  });

  // =========================================================================
  group('Configuración · datos del negocio', () {
    for (final c in _cases) {
      testWidgets('pantalla y formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c);
        await shoot(tester, 'cfg_negocio${c.tag}');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');

        // Primer campo.
        await _typeIn(tester, _field('Nombre comercial'));
        await shoot(tester, 'cfg_negocio_teclado_primero${c.tag}');
        // Un campo de varias líneas (descripción).
        await _typeIn(tester, _field('Descripción'));
        // Último campo de texto: el nombre del último tramo del horario.
        await _typeIn(tester, find.byType(TextFormField).last);
        await shoot(tester, 'cfg_negocio_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        expectReachable(tester, find.text('Tarde').last, what: 'el último turno del horario');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_negocio_fin${c.tag}');
      });

      testWidgets('el reloj de los horarios (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c, api: api);
        final hour = find.widgetWithText(OutlinedButton, '09:00').first;
        await tester.ensureVisible(hour);
        await tester.pump();
        await tester.tap(hour);
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir el reloj');
        // Es el reloj de la app: en castellano y de 24 h.
        expect(find.text('Cancelar'), findsOneWidget);
        expect(find.text('Aceptar'), findsOneWidget);
        expect(find.textContaining('AM'), findsNothing, reason: 'reloj de 24 h, sin AM/PM');
        expect(find.textContaining('SELECT'), findsNothing, reason: 'el reloj va en castellano');
        expectReachable(tester, find.text('Aceptar'), what: 'el botón Aceptar del reloj');
        expectReachable(tester, find.text('Cancelar'), what: 'el botón Cancelar del reloj');
        _expectInsideScreen(tester, find.byType(Dialog), 'el reloj');
        await shoot(tester, 'cfg_negocio_reloj${c.tag}');

        // Aceptar sin cambiar la hora no ensucia el formulario; cancelar tampoco.
        await tester.tap(find.text('Aceptar'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al cerrar el reloj');
        expect(find.byType(Dialog), findsNothing);
        expect(tester.widget<InkWell>(find.descendant(of: _gold('Guardar cambios'), matching: find.byType(InkWell))).onTap,
            isNull, reason: 'aceptar la misma hora no es un cambio');
      });

      testWidgets('"Cambios sin guardar" al volver (${c.label})', (tester) async {
        await _pumpCfg(tester, _Opener(NegocioScreen(initial: _config.negocio, canEdit: true)), c);
        await _open(tester);
        await tester.enterText(_field('Eslogan'), 'Otro eslogan');
        await tester.pump();
        await tester.tap(find.byType(BackButton));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir el aviso de cambios sin guardar');
        expect(find.text('Cambios sin guardar'), findsOneWidget);
        expectReachable(tester, find.text('Seguir editando'), what: 'el botón Seguir editando');
        expectReachable(tester, find.text('Salir sin guardar'), what: 'el botón Salir sin guardar');
        await shoot(tester, 'cfg_descartar${c.tag}');
        await tester.tap(find.text('Seguir editando'));
        await settle(tester);
        expect(find.text('Nombre comercial'), findsOneWidget, reason: 'se queda en el formulario');
        expect(find.text('Otro eslogan'), findsOneWidget, reason: 'no pierde lo escrito');

        await tester.tap(find.byType(BackButton));
        await settle(tester);
        await tester.tap(find.text('Salir sin guardar'));
        await settle(tester, 9);
        expect(find.byKey(const Key('abrir')), findsOneWidget, reason: 'volvió a la pantalla anterior');
      });

      testWidgets('con datos larguísimos y en solo lectura (${c.label})', (tester) async {
        await _pumpCfg(tester, NegocioScreen(initial: _bigConfig.negocio, canEdit: true), c);
        await shoot(tester, 'cfg_negocio_largo${c.tag}');
        await scrollToEnd(tester);
        await shoot(tester, 'cfg_negocio_largo_fin${c.tag}');
        expectReachable(tester, find.text('Tarde').last, what: 'el último turno del horario');
        // Escribir al final de un tramo largo, con el teclado abierto.
        await _typeIn(tester, find.byType(TextFormField).last);

        // Solo lectura: sin barra de guardar, lo último no queda debajo de la barra del sistema.
        await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: false), c, me: _viewer);
        expect(find.text('Guardar cambios'), findsNothing);
        expect(find.text('Tu rol puede ver esta sección, pero no cambiarla.'), findsOneWidget);
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Tarde').last, what: 'el último turno (solo lectura)');
        await shoot(tester, 'cfg_negocio_solo_ver_fin${c.tag}');

        // Sin horarios ni datos.
        await _pumpCfg(tester, NegocioScreen(initial: _emptyConfig.negocio, canEdit: true), c);
        await scrollToEnd(tester);
        await shoot(tester, 'cfg_negocio_vacio_fin${c.tag}');
      });
    }

    testWidgets('elegir una hora en el reloj la cambia y habilita Guardar', (tester) async {
      const c = _Case(Phone.small);
      final api = _Api();
      await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c, api: api);
      final hour = find.widgetWithText(OutlinedButton, '09:00').first;
      await tester.ensureVisible(hour);
      await tester.pump();
      await tester.tap(hour);
      await settle(tester, 8);
      // Pasa a "escribir la hora" y carga 07:45.
      await tester.tap(find.byIcon(Icons.keyboard_outlined));
      await settle(tester, 6);
      expectNoLayoutErrors(tester, 'al pasar el reloj a modo teclado');
      final inputs = find.descendant(of: find.byType(Dialog), matching: find.byType(TextField));
      expect(inputs, findsNWidgets(2));
      await tester.enterText(inputs.first, '07');
      await tester.enterText(inputs.last, '45');
      await tester.pump();
      await openKeyboard(tester, inputs.last);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.text('Aceptar'), what: 'Aceptar del reloj con el teclado abierto');
      await shoot(tester, 'cfg_negocio_reloj_teclado');
      await tester.tap(find.text('Aceptar'));
      await closeKeyboard(tester);
      await settle(tester, 6);
      expect(find.widgetWithText(OutlinedButton, '07:45'), findsOneWidget);
      await tester.tap(_gold('Guardar cambios'));
      await settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(((body['hours'] as List).first as Map)['morning'], {'on': true, 'from': '07:45', 'to': '13:00'});
    });
  });

  // =========================================================================
  group('Configuración · tienda y apariencia', () {
    for (final c in _cases) {
      testWidgets('pantalla y campo de color con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, TiendaScreen(initial: _config.tienda, canEdit: true), c);
        await shoot(tester, 'cfg_tienda${c.tag}');
        await _typeIn(tester, _field('Otro color (hex)'));
        await shoot(tester, 'cfg_tienda_teclado${c.tag}');
        await closeKeyboard(tester);
        await tester.ensureVisible(find.text('Promo de verano'));
        await settle(tester, 2);
        expectReachable(tester, find.text('Promo de verano'), what: 'el último banner');
        await scrollToEnd(tester);
        // Lo último de la pantalla: la imagen de portada con su botón.
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Cambiar imagen de portada'),
            what: 'el botón de la imagen de portada');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_tienda_fin${c.tag}');
      });

      testWidgets('imágenes desde el teléfono: logo, portada y la hoja para elegir (${c.label})', (tester) async {
        final api = _Api();
        final source = FakePhotoSource(gallery: [fakePhoto('logo.png')], camera: fakePhoto('portada.jpg'));
        await _pumpCfg(tester, TiendaScreen(initial: _config.tienda, canEdit: true), c, api: api, photos: source);
        final logo = find.widgetWithText(OutlinedButton, 'Cambiar logo');
        expectReachable(tester, logo, what: 'el botón Cambiar logo');
        await tester.tap(logo);
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir la hoja de imagen');
        final sheet = find.byType(BottomSheet);
        expect(tester.getRect(sheet).top >= currentPhone.top - 0.5, isTrue,
            reason: 'la hoja se mete debajo de la barra de estado');
        expectReachable(tester, find.descendant(of: sheet, matching: find.text('Elegir de la galería')),
            what: 'la opción de la galería');
        expectReachable(tester, find.descendant(of: sheet, matching: find.text('Sacar una foto')),
            what: 'la opción de la cámara');
        await shoot(tester, 'cfg_imagen_hoja${c.tag}');
        await tester.tap(find.text('Elegir de la galería'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.calls.single.$2, {'kind': 'logo', 'filename': 'logo.png'});
        expect(find.text('Logo actualizado'), findsOneWidget);
        await shoot(tester, 'cfg_logo_actualizado${c.tag}');

        // La portada, con la cámara; el aviso de un rechazo se lee entero.
        api.failWith = 'No pudimos procesar la imagen. Probá con otra foto, en JPG, PNG o WebP y de menos de 4 MB.';
        await scrollToEnd(tester);
        await tester.tap(find.widgetWithText(OutlinedButton, 'Cambiar imagen de portada'));
        await settle(tester, 8);
        await tester.tap(find.text('Sacar una foto'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(api.calls.last.$2, {'kind': 'hero', 'filename': 'portada.jpg'});
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('No pudimos procesar la imagen'), what: 'el aviso del rechazo');
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Cambiar imagen de portada'),
            what: 'el botón de la portada después del rechazo');
        await shoot(tester, 'cfg_portada_error${c.tag}');
      });

      testWidgets('con 12 temporadas, 11 secciones y 12 banners largos (${c.label})', (tester) async {
        await _pumpCfg(tester, TiendaScreen(initial: _bigConfig.tienda, canEdit: true), c, config: _bigConfig);
        await shoot(tester, 'cfg_tienda_largo${c.tag}');
        // Mitad de la pantalla: temporadas y decoración.
        await tester.ensureVisible(find.text('Decoración animada'));
        await settle(tester, 2);
        await shoot(tester, 'cfg_tienda_largo_temporada${c.tag}');
        await tester.ensureVisible(find.text('Segundos entre banners'));
        await settle(tester, 2);
        await shoot(tester, 'cfg_tienda_largo_banners${c.tag}');
        await tester.ensureVisible(find.text('Promo 12'));
        await settle(tester, 2);
        expectReachable(tester, find.text('Promo 12'), what: 'el último banner');
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Nuevo banner'), what: 'el botón Nuevo banner');
        await shoot(tester, 'cfg_tienda_largo_fin${c.tag}');

        // Sin temporadas, secciones ni banners; y en solo lectura.
        await _pumpCfg(tester, TiendaScreen(initial: _emptyConfig.tienda, canEdit: false), c,
            config: _emptyConfig, me: _viewer);
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('Todavía no hay banners'), what: 'el aviso de "sin banners"');
        await shoot(tester, 'cfg_tienda_vacio_fin${c.tag}');
      });
    }

    testWidgets('las muestras de color y los chips de temporada son cómodos de tocar', (tester) async {
      await _pumpCfg(tester, TiendaScreen(initial: _bigConfig.tienda, canEdit: true), const _Case(Phone.small),
          config: _bigConfig);
      final swatches = find.byWidgetPredicate(
        (w) => w is Semantics && (w.properties.label ?? '').startsWith('Color #'),
      );
      expect(swatches, findsNWidgets(accentChoices.length));
      for (final s in swatches.evaluate()) {
        final size = (s.renderObject! as RenderBox).size;
        expect(size.width >= 44 && size.height >= 44, isTrue, reason: 'muestra de color de $size (mínimo 44 dp)');
      }
      for (final s in _seasons) {
        final chip = find.ancestor(of: find.text(s.$2), matching: find.byType(InkWell)).first;
        expect(tester.getSize(chip).height >= 44, isTrue,
            reason: 'chip "${s.$2}" de ${tester.getSize(chip).height} dp de alto (mínimo 44)');
      }
    });

    testWidgets('tocar un banner abre su edición', (tester) async {
      await _pumpCfg(tester, TiendaScreen(initial: _config.tienda, canEdit: true), const _Case(Phone.small));
      await tester.ensureVisible(find.text('Figuras de colección'));
      await tester.pump();
      await tester.tap(find.text('Figuras de colección'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expect(find.text('Mostrar en la tienda'), findsOneWidget);
    });
  });

  // =========================================================================
  group('Configuración · banner', () {
    final banner = _config.tienda.banners.first;
    final longBanner = _bigConfig.tienda.banners.first;

    for (final c in _cases) {
      testWidgets('pantalla, alineación en una línea y formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, BannerEditScreen(banner: banner, canEdit: true), c);
        await shoot(tester, 'cfg_banner${c.tag}');
        await tester.ensureVisible(find.text('Derecha'));
        await settle(tester, 2);
        for (final label in ['Izquierda', 'Centro', 'Derecha']) {
          expect(_lines(tester, find.text(label)), 1, reason: '"$label" tiene que entrar en una línea');
        }
        final seg = tester.getRect(
          find.ancestor(of: find.text('Izquierda'), matching: find.byType(SegmentedButton<String>)),
        );
        expect(seg.left >= 0 && seg.right <= currentPhone.width, isTrue, reason: 'la alineación se sale de la pantalla');
        await shoot(tester, 'cfg_banner_alineacion${c.tag}');

        await _typeIn(tester, _field('Título'));
        await shoot(tester, 'cfg_banner_teclado_primero${c.tag}');
        await _typeIn(tester, _field('Subtítulo'));
        await _typeIn(tester, _field('A dónde lleva'));
        await shoot(tester, 'cfg_banner_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Eliminar banner'), what: 'el botón Eliminar banner');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_banner_fin${c.tag}');
      });

      testWidgets('eliminar pide confirmación; con título larguísimo (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, _Opener(BannerEditScreen(banner: longBanner, canEdit: true)), c, api: api);
        await _open(tester);
        await shoot(tester, 'cfg_banner_largo${c.tag}');
        await scrollToEnd(tester);
        await tester.tap(find.widgetWithText(OutlinedButton, 'Eliminar banner'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la confirmación');
        final dialog = find.byType(AlertDialog);
        expect(dialog, findsOneWidget);
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Eliminar')), what: 'el botón Eliminar');
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Cancelar')), what: 'el botón Cancelar');
        _expectInsideScreen(tester, dialog, 'la confirmación');
        await shoot(tester, 'cfg_banner_eliminar${c.tag}');

        // Cancelar no borra nada.
        await tester.tap(find.descendant(of: dialog, matching: find.text('Cancelar')));
        await settle(tester);
        expect(api.calls, isEmpty);
        expect(find.text('Mostrar en la tienda'), findsOneWidget);

        await tester.tap(find.widgetWithText(OutlinedButton, 'Eliminar banner'));
        await settle(tester);
        await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Eliminar')));
        await settle(tester, 9);
        expect(api.calls.single, ('banner_delete', longBanner.id));
        expect(find.byKey(const Key('abrir')), findsOneWidget, reason: 'vuelve a la pantalla anterior');
        expect(find.text('Banner eliminado'), findsOneWidget);
        expectNoLayoutErrors(tester);
      });

      testWidgets('solo lectura: sin guardar ni eliminar, y lo último a la vista (${c.label})', (tester) async {
        await _pumpCfg(tester, BannerEditScreen(banner: longBanner, canEdit: false), c, me: _viewer);
        expect(find.text('Guardar cambios'), findsNothing);
        expect(find.text('Eliminar banner'), findsNothing);
        await scrollToEnd(tester);
        expectReachable(tester, _field('A dónde lleva'), what: 'el último campo (solo lectura)');
        await shoot(tester, 'cfg_banner_solo_ver_fin${c.tag}');
      });
    }

    for (final c in _cases) {
      testWidgets('banner nuevo: elegir imagen, encuadre, teclado y crear (${c.label})', (tester) async {
        final api = _Api();
        final source = FakePhotoSource(gallery: [fakePhoto('promo de invierno con un nombre de archivo larguísimo.jpg')]);
        await _pumpCfg(tester, _Opener(const BannerEditScreen(canEdit: true)), c, api: api, photos: source);
        await _open(tester);
        expect(find.text('Nuevo banner'), findsOneWidget);
        expect(find.text('Sin imagen'), findsOneWidget);
        expectReachable(tester, _gold('Crear banner'), what: 'el botón Crear banner');
        await shoot(tester, 'cfg_banner_nuevo${c.tag}');

        // Elegir la imagen: la hoja entra y sus opciones se pueden tocar.
        await tester.tap(find.widgetWithText(OutlinedButton, 'Elegir imagen'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir la hoja de imagen');
        final sheet = find.byType(BottomSheet);
        expect(tester.getRect(sheet).top >= currentPhone.top - 0.5, isTrue,
            reason: 'la hoja se mete debajo de la barra de estado');
        expectReachable(tester, find.descendant(of: sheet, matching: find.text('Sacar una foto')),
            what: 'la opción de la cámara');
        await shoot(tester, 'cfg_banner_nuevo_hoja${c.tag}');
        await tester.tap(find.text('Elegir de la galería'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
        expect(find.text('Imagen nueva: se sube al guardar.'), findsOneWidget);

        // Encuadre: los tres rótulos en una línea y dentro de la pantalla.
        await tester.ensureVisible(find.text('Abajo'));
        await settle(tester, 2);
        for (final label in ['Arriba', 'Medio', 'Abajo']) {
          expect(_lines(tester, find.text(label)), 1, reason: '"$label" tiene que entrar en una línea');
        }
        final frames = tester.getRect(
          find.ancestor(of: find.text('Arriba'), matching: find.byType(SegmentedButton<String>)),
        );
        expect(frames.left >= 0 && frames.right <= currentPhone.width, isTrue, reason: 'el encuadre se sale de la pantalla');
        await tester.tap(find.text('Abajo'));
        await settle(tester, 2);
        await shoot(tester, 'cfg_banner_nuevo_imagen${c.tag}');

        await _typeIn(tester, _field('Título'), save: 'Crear banner');
        await tester.enterText(_field('Título'), _rep('Promo de invierno ', 110));
        await settle(tester, 2);
        await _typeIn(tester, _field('Subtítulo'), save: 'Crear banner');
        await _typeIn(tester, _field('A dónde lleva'), save: 'Crear banner');
        await shoot(tester, 'cfg_banner_nuevo_teclado${c.tag}');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expect(find.text('Eliminar banner'), findsNothing);
        expectReachable(tester, _field('A dónde lleva'), what: 'el último campo');
        await shoot(tester, 'cfg_banner_nuevo_fin${c.tag}');

        await tester.tap(_gold('Crear banner'));
        await settle(tester, 9);
        expectNoLayoutErrors(tester);
        expect(api.calls.map((x) => x.$1), ['image', 'banner_create']);
        expect((api.calls.last.$2! as Map<String, dynamic>)['position'], '50% 100%');
        expect(find.byKey(const Key('abrir')), findsOneWidget, reason: 'vuelve a la pantalla anterior');
        expect(find.text('Banner creado'), findsOneWidget);
      });
    }

    testWidgets('banner nuevo con letra grande: foto pesada, permiso negado y salir con cambios', (tester) async {
      const c = _Case(Phone.small, 1.3);
      final source = FakePhotoSource(
        gallery: [PickedPhoto(bytes: Uint8List(maxUploadImageBytes + 1), filename: 'pesada.jpg')],
      );
      await _pumpCfg(tester, _Opener(const BannerEditScreen(canEdit: true)), c, photos: source);
      await _open(tester);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Elegir imagen'));
      await settle(tester, 8);
      await tester.tap(find.text('Elegir de la galería'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.text('La foto pesa más de 4 MB. Probá con una más liviana.'), what: 'el aviso del peso');
      await shoot(tester, 'cfg_banner_nuevo_pesada_grande');

      source.failWith = Exception('camera_access_denied');
      await tester.tap(find.widgetWithText(OutlinedButton, 'Elegir imagen'));
      await settle(tester, 8);
      await tester.tap(find.text('Sacar una foto'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.textContaining('No pudimos abrir la cámara'), what: 'el aviso del permiso');
      await shoot(tester, 'cfg_banner_nuevo_permiso_grande');

      // Con algo escrito, "atrás" pregunta antes de perderlo.
      await tester.enterText(_field('Título'), 'Promo');
      await tester.pump();
      await tester.binding.handlePopRoute();
      await settle(tester);
      expectNoLayoutErrors(tester);
      expect(find.byType(AlertDialog), findsOneWidget);
      _expectInsideScreen(tester, find.byType(AlertDialog), 'la confirmación de salir');
      await shoot(tester, 'cfg_banner_nuevo_salir_grande');
    });

    testWidgets('si el servidor rechaza el guardado o el borrado, el error se ve y no se pierde nada', (tester) async {
      const c = _Case(Phone.small, 1.3);
      final api = _Api(failWith: 'No pudimos completar la operación. Probá de nuevo en unos segundos.');
      await _pumpCfg(tester, BannerEditScreen(banner: banner, canEdit: true), c, api: api);
      await tester.enterText(_field('Título'), 'Nuevo título');
      await tester.pump();
      await tester.tap(_gold('Guardar cambios'));
      await settle(tester);
      expect(find.textContaining('No pudimos completar la operación'), findsOneWidget);
      expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar con el error a la vista');
      await shoot(tester, 'cfg_banner_error_grande');
      // Con el error en la barra y el teclado abierto, el campo sigue a la vista.
      await _typeIn(tester, _field('A dónde lleva'));
      await shoot(tester, 'cfg_banner_error_teclado_grande');
    });
  });

  // =========================================================================
  group('Configuración · envío y retiro', () {
    for (final c in _cases) {
      testWidgets('pantalla y formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, EnviosScreen(initial: _config.envios, canEdit: true), c);
        await shoot(tester, 'cfg_envios${c.tag}');
        await _typeIn(tester, _field('Ciudad de envío'));
        await shoot(tester, 'cfg_envios_teclado_primero${c.tag}');
        await _typeIn(tester, _field('Envío gratis desde (ARS)'));
        // Precio del último barrio.
        await _typeIn(tester, find.widgetWithText(TextFormField, '2000.5'));
        // Último campo: el mensaje (varias líneas).
        await _typeIn(tester, _field('Mensaje "fuera de Iguazú"'));
        await shoot(tester, 'cfg_envios_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expectReachable(tester, _field('Mensaje "fuera de Iguazú"'), what: 'el último campo');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_envios_fin${c.tag}');
      });

      testWidgets('con 35 barrios y montos de 9 cifras; agregar uno lo deja a la vista (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, EnviosScreen(initial: _bigConfig.envios, canEdit: true), c, api: api);
        await shoot(tester, 'cfg_envios_largo${c.tag}');
        expect(find.widgetWithText(TextFormField, '123456789'), findsWidgets);
        await tester.ensureVisible(find.widgetWithText(TextFormField, 'Barrio 4').first);
        await settle(tester, 2);
        await shoot(tester, 'cfg_envios_largo_barrios${c.tag}');

        // El botón de agregar está al final de la lista: la fila nueva aparece ahí mismo.
        final add = find.widgetWithText(OutlinedButton, 'Agregar barrio');
        await tester.ensureVisible(add);
        await settle(tester, 2);
        expect(tester.getSize(add).height >= 44, isTrue, reason: 'botón "Agregar barrio" cómodo de tocar');
        await tester.tap(add);
        await settle(tester, 5);
        expectNoLayoutErrors(tester, 'al agregar un barrio');
        final fresh = find.widgetWithText(TextFormField, 'Barrio 36');
        expectReachable(tester, fresh, what: 'la fila del barrio recién agregado');
        await shoot(tester, 'cfg_envios_largo_agregado${c.tag}');
        await _typeIn(tester, fresh);
        await tester.enterText(fresh, 'Villa Cabot');
        await tester.pump();
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo');
        await _typeIn(tester, find.byType(TextFormField).last);
        await closeKeyboard(tester);

        await tester.tap(_gold('Guardar cambios'));
        await settle(tester);
        final body = api.calls.single.$2! as Map<String, dynamic>;
        expect((body['zones'] as List), hasLength(36));
        expect((body['zones'] as List).last, {'name': 'Villa Cabot', 'price': 0});
        expect(body['freeOver'], 123456789);
        expect(find.text('Envíos guardados'), findsOneWidget);
        await shoot(tester, 'cfg_envios_guardado${c.tag}');
      });

      testWidgets('sin barrios, y en solo lectura (${c.label})', (tester) async {
        await _pumpCfg(tester, EnviosScreen(initial: _emptyConfig.envios, canEdit: true), c);
        expect(find.textContaining('Todavía no hay barrios'), findsOneWidget);
        await shoot(tester, 'cfg_envios_vacio${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, _field('Mensaje "fuera de tu ciudad"'), what: 'el último campo');

        await _pumpCfg(tester, EnviosScreen(initial: _bigConfig.envios, canEdit: false), c, me: _viewer);
        expect(find.text('Agregar barrio'), findsNothing);
        expect(find.byTooltip('Quitar barrio'), findsNothing);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo (solo lectura)');
        await shoot(tester, 'cfg_envios_solo_ver_fin${c.tag}');
      });
    }

    testWidgets('un precio de barrio mal escrito no se guarda como 0: avisa', (tester) async {
      const c = _Case(Phone.small);
      final api = _Api();
      await _pumpCfg(tester, EnviosScreen(initial: _config.envios, canEdit: true), c, api: api);
      await tester.enterText(find.widgetWithText(TextFormField, '1500'), '1.5.0');
      await tester.pump();
      await tester.tap(_gold('Guardar cambios'));
      await settle(tester);
      expect(api.calls, isEmpty, reason: 'un precio ilegible no puede viajar como 0 (envío gratis sin querer)');
      expect(find.text('Revisá los campos marcados.'), findsOneWidget);
      expect(find.text('Precio inválido.'), findsOneWidget);
      await shoot(tester, 'cfg_envios_precio_invalido');

      // Con coma decimal y punto de miles se entiende bien.
      await tester.enterText(find.widgetWithText(TextFormField, '1.5.0'), '1.500,50');
      await tester.pump();
      await tester.tap(_gold('Guardar cambios'));
      await settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect((body['zones'] as List).first, {'name': 'Centro', 'price': 1500.5});
    });
  });

  // =========================================================================
  group('Configuración · medios de pago', () {
    final allOn = PagosConfig.fromJson({...(configJson()['pagos'] as Map<String, dynamic>), 'cashEnabled': true});
    final connected = PagosConfig.fromJson({...(configJson()['pagos'] as Map<String, dynamic>), 'mpConnected': true});

    for (final c in _cases) {
      testWidgets('pantalla y formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, PagosScreen(initial: allOn, canEdit: true), c);
        await shoot(tester, 'cfg_pagos${c.tag}');
        await _typeIn(tester, _field('Alias'));
        await shoot(tester, 'cfg_pagos_teclado_primero${c.tag}');
        await _typeIn(tester, _field('CBU / CVU'));
        // Último campo: la nota del efectivo.
        await _typeIn(tester, find.byType(TextFormField).last);
        await shoot(tester, 'cfg_pagos_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_pagos_fin${c.tag}');
      });

      testWidgets('el diálogo del token de MercadoPago con el teclado abierto (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, PagosScreen(initial: allOn, canEdit: true), c, api: api);
        final connect = find.widgetWithText(TextButton, 'Conectar');
        await tester.ensureVisible(connect);
        await tester.pump();
        await tester.tap(connect);
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir el diálogo del token');
        final dialog = find.byType(AlertDialog);
        expect(dialog, findsOneWidget);
        final field = find.descendant(of: dialog, matching: find.byType(TextField));
        final ok = find.descendant(of: dialog, matching: find.text('Conectar'));
        final cancel = find.descendant(of: dialog, matching: find.text('Cancelar'));
        expectReachable(tester, ok, what: 'el botón Conectar del diálogo');
        expectReachable(tester, cancel, what: 'el botón Cancelar del diálogo');
        await shoot(tester, 'cfg_pagos_token${c.tag}');

        await openKeyboard(tester, field);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'el botón Conectar con el teclado abierto');
        expectReachable(tester, cancel, what: 'el botón Cancelar con el teclado abierto');
        _expectInsideScreen(tester, dialog, 'el diálogo del token');
        await shoot(tester, 'cfg_pagos_token_teclado${c.tag}');

        // Muy corto: avisa (con el teclado todavía abierto el error tiene que entrar).
        await tester.enterText(field, 'abc');
        await tester.tap(ok);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al mostrar el error del token');
        expect(find.text('Pegá tu Access Token completo.'), findsOneWidget);
        expectFocusedFieldVisible(tester);
        expectReachable(tester, ok, what: 'el botón Conectar con el error y el teclado');
        await shoot(tester, 'cfg_pagos_token_error${c.tag}');
        expect(api.calls, isEmpty);

        await tester.enterText(field, 'APP_USR-${_rep('1234567890', 70)}');
        await tester.pump();
        await tester.tap(find.byTooltip('Mostrar'));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'al mostrar un token largo');
        await shoot(tester, 'cfg_pagos_token_largo${c.tag}');
        await tester.tap(ok);
        await closeKeyboard(tester);
        await settle(tester);
        expect(api.calls.single.$1, 'mp_connect');
        expect(find.text('Conectado'), findsOneWidget);
        expect(find.text('MercadoPago conectado'), findsOneWidget);
        expect(find.textContaining('APP_USR'), findsNothing, reason: 'el token no queda en pantalla');
        await shoot(tester, 'cfg_pagos_conectado${c.tag}');
      });

      testWidgets('desconectar MercadoPago pide confirmación (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, PagosScreen(initial: connected, canEdit: true), c, api: api);
        final off = find.widgetWithText(TextButton, 'Desconectar');
        await tester.ensureVisible(off);
        await tester.pump();
        await shoot(tester, 'cfg_pagos_conectado_antes${c.tag}');
        await tester.tap(off);
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la confirmación');
        final dialog = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Desconectar')), what: 'Desconectar');
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Cancelar')), what: 'Cancelar');
        await shoot(tester, 'cfg_pagos_desconectar${c.tag}');
        await tester.tap(find.descendant(of: dialog, matching: find.text('Desconectar')));
        await settle(tester);
        expect(api.calls.single.$1, 'mp_disconnect');
        expect(find.text('Sin conectar'), findsOneWidget);
      });

      testWidgets('con notas larguísimas, y en solo lectura (${c.label})', (tester) async {
        await _pumpCfg(tester, PagosScreen(initial: _bigConfig.pagos, canEdit: true), c);
        await shoot(tester, 'cfg_pagos_largo${c.tag}');
        await scrollToEnd(tester);
        await shoot(tester, 'cfg_pagos_largo_fin${c.tag}');
        await _typeIn(tester, find.byType(TextFormField).last);

        await _pumpCfg(tester, PagosScreen(initial: _bigConfig.pagos, canEdit: false), c, me: _viewer);
        expect(find.text('Conectar'), findsNothing);
        expect(find.text('Cambiar token'), findsNothing);
        expect(find.text('Desconectar'), findsNothing);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo (solo lectura)');
        await shoot(tester, 'cfg_pagos_solo_ver_fin${c.tag}');
      });
    }

    testWidgets('si falla la conexión con MercadoPago se ve el error del servidor', (tester) async {
      const c = _Case(Phone.small, 1.3);
      final api = _Api(failWith: 'El token no parece válido (muy corto).');
      await _pumpCfg(tester, PagosScreen(initial: allOn, canEdit: true), c, api: api);
      final connect = find.widgetWithText(TextButton, 'Conectar');
      await tester.ensureVisible(connect);
      await tester.pump();
      await tester.tap(connect);
      await settle(tester);
      await tester.enterText(find.descendant(of: find.byType(AlertDialog), matching: find.byType(TextField)), 'APP_USR-1234567890');
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Conectar')));
      await settle(tester);
      expect(find.text('El token no parece válido (muy corto).'), findsOneWidget);
      expect(find.text('Sin conectar'), findsOneWidget, reason: 'sigue sin conectar');
      expectNoLayoutErrors(tester);
      await shoot(tester, 'cfg_pagos_mp_error_grande');
    });
  });

  // =========================================================================
  group('Configuración · equipo y roles', () {
    for (final c in _cases) {
      testWidgets('equipo y roles: listas completas (${c.label})', (tester) async {
        await _pumpCfg(tester, const EquipoScreen(), c);
        expect(find.text('Equipo (3)'), findsOneWidget);
        await shoot(tester, 'cfg_equipo${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.text('Sin rol'), what: 'el último miembro');

        await tester.tap(find.text('Roles (2)'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al pasar a Roles');
        await shoot(tester, 'cfg_roles${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.text('Operador'), what: 'el último rol');
      });

      testWidgets('32 personas y 34 roles con nombres larguísimos (${c.label})', (tester) async {
        await _pumpCfg(tester, const EquipoScreen(), c, team: _bigTeam);
        await shoot(tester, 'cfg_equipo_largo${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.byType(MemberTile).last, what: 'el último miembro');
        await shoot(tester, 'cfg_equipo_largo_fin${c.tag}');

        await tester.tap(find.text('Roles (34)'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al pasar a Roles');
        await shoot(tester, 'cfg_roles_largo${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.byType(RoleTile).last, what: 'el último rol');
        await shoot(tester, 'cfg_roles_largo_fin${c.tag}');
      });

      testWidgets('sin miembros, solo lectura, error y cargando (${c.label})', (tester) async {
        await _pumpCfg(tester, const EquipoScreen(), c,
            team: TeamData.fromJson({...teamJson(), 'team': <Object>[]}));
        expect(find.text('Todavía no hay miembros'), findsOneWidget);
        await shoot(tester, 'cfg_equipo_vacio${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.text('Invitá a alguien para que entre al panel.'), what: 'el aviso de lista vacía');

        await _pumpCfg(tester, const EquipoScreen(), c,
            me: _viewer, team: TeamData.fromJson(_bigTeamJson(canManage: false)));
        expect(find.text('Invitar a alguien'), findsNothing);
        expect(find.textContaining('Solo un administrador puede invitar'), findsOneWidget);
        await shoot(tester, 'cfg_equipo_solo_ver${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.byType(MemberTile).last, what: 'el último miembro (solo lectura)');

        await _pumpCfg(
          tester,
          const EquipoScreen(),
          c,
          teamOverride: adminTeamProvider.overrideWith(
            (ref) => throw ApiException('forbidden', 'No tenés permiso para hacer esto.'),
          ),
        );
        expectReachable(tester, _gold('Reintentar'), what: 'el botón Reintentar');
        await shoot(tester, 'cfg_equipo_error${c.tag}');

        await _pumpCfg(tester, const EquipoScreen(), c,
            teamOverride: adminTeamProvider.overrideWith((ref) => Completer<TeamData>().future));
        expect(find.text('Equipo'), findsOneWidget);
        await shoot(tester, 'cfg_equipo_cargando${c.tag}');
      });

      testWidgets('la hoja de un miembro: acciones, rol y quitar acceso (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, const EquipoScreen(), c, api: api);
        await tester.tap(find.text('anto@x.com').first);
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la hoja del miembro');
        final sheet = find.byType(BottomSheet);
        expect(sheet, findsOneWidget);
        _expectInsideScreen(tester, sheet, 'la hoja del miembro');
        expectReachable(tester, find.text('Reenviar invitación'), what: 'Reenviar invitación');
        expectReachable(tester, find.text('Cambiar rol'), what: 'Cambiar rol');
        expectReachable(tester, find.text('Quitar acceso al panel'), what: 'Quitar acceso al panel');
        await shoot(tester, 'cfg_equipo_hoja${c.tag}');

        // Elegir rol.
        await tester.tap(find.text('Cambiar rol'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la lista de roles');
        expect(find.text('Elegí el rol'), findsOneWidget);
        expectReachable(tester, find.text('Administrador').last, what: 'la opción Administrador');
        await shoot(tester, 'cfg_equipo_elegir_rol${c.tag}');
        await _tapOutside(tester);
        expect(find.text('Elegí el rol'), findsNothing, reason: 'tocar fuera cierra la lista');
        expect(api.calls, isEmpty);

        // Quitar acceso: confirmación.
        await tester.tap(find.text('Quitar acceso al panel'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la confirmación');
        final dialog = find.byType(AlertDialog);
        final remove = find.descendant(of: dialog, matching: find.widgetWithText(FilledButton, 'Quitar acceso'));
        expectReachable(tester, remove, what: 'el botón Quitar acceso');
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Cancelar')), what: 'Cancelar');
        await shoot(tester, 'cfg_equipo_quitar${c.tag}');
        await tester.tap(remove);
        await settle(tester);
        expect(api.calls.single, ('remove', 'u2'));
        expect(find.byType(BottomSheet), findsNothing, reason: 'la hoja se cierra al terminar');
        expect(find.text('Acceso revocado'), findsOneWidget);
        expectNoLayoutErrors(tester);
      });

      testWidgets('la hoja con nombres larguísimos y 34 roles para elegir (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, const EquipoScreen(), c, api: api, team: _bigTeam);
        // Persona 3: nombre y mail largos, activa.
        await tester.ensureVisible(find.byType(MemberTile).at(2));
        await tester.pump();
        await tester.tap(find.byType(MemberTile).at(2));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la hoja');
        _expectInsideScreen(tester, find.byType(BottomSheet), 'la hoja del miembro');
        expectReachable(tester, find.text('Quitar acceso al panel'), what: 'Quitar acceso al panel');
        await shoot(tester, 'cfg_equipo_hoja_larga${c.tag}');

        await tester.tap(find.text('Cambiar rol'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir 34 roles');
        final dialog = find.byType(SimpleDialog);
        _expectInsideScreen(tester, dialog, 'la lista de roles');
        await shoot(tester, 'cfg_equipo_elegir_rol_largo${c.tag}');
        // Se desplaza hasta el último y se puede elegir.
        final last = find.descendant(of: dialog, matching: find.text('Rol 34'));
        await tester.scrollUntilVisible(last, 200,
            scrollable: find.descendant(of: dialog, matching: find.byType(Scrollable)).first);
        await settle(tester, 2);
        expectReachable(tester, last, what: 'el último rol de la lista');
        await shoot(tester, 'cfg_equipo_elegir_rol_largo_fin${c.tag}');
        await tester.tap(last);
        await settle(tester);
        expect(api.calls.single.$1, 'assign');
        expect(find.text('Rol actualizado'), findsOneWidget);

        // Quitar acceso a alguien de nombre larguísimo: la pregunta entra entera.
        await tester.tap(find.byType(MemberTile).at(2));
        await settle(tester);
        await tester.tap(find.text('Quitar acceso al panel'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la confirmación larga');
        final confirm = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: confirm, matching: find.widgetWithText(FilledButton, 'Quitar acceso')),
            what: 'el botón Quitar acceso');
        expectReachable(tester, find.descendant(of: confirm, matching: find.text('Cancelar')), what: 'Cancelar');
        await shoot(tester, 'cfg_equipo_quitar_largo${c.tag}');
      });

      testWidgets('uno mismo no se puede tocar; un error del servidor se ve en la hoja (${c.label})', (tester) async {
        await _pumpCfg(tester, const EquipoScreen(), c);
        await tester.tap(find.text('Ale (vos)'));
        await settle(tester);
        expect(find.textContaining('Sos vos'), findsOneWidget);
        expect(find.text('Cambiar rol'), findsNothing);
        expect(find.text('Quitar acceso al panel'), findsNothing);
        _expectInsideScreen(tester, find.byType(BottomSheet), 'la hoja');
        expectReachable(tester, find.textContaining('Sos vos'), what: 'el aviso de "sos vos"');
        await shoot(tester, 'cfg_equipo_hoja_yo${c.tag}');
        await _tapOutside(tester);
        expect(find.byType(BottomSheet), findsNothing, reason: 'tocar fuera cierra la hoja');

        final api = _Api(
          failWith: 'Falta configurar el envío de correos (RESEND_API_KEY): la invitación no se puede mandar.',
        );
        await _pumpCfg(tester, const EquipoScreen(), c, api: api);
        await tester.tap(find.text('anto@x.com').first);
        await settle(tester);
        await tester.tap(find.text('Reenviar invitación'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al mostrar el error en la hoja');
        expectReachable(tester, find.textContaining('Falta configurar el envío de correos'), what: 'el error del servidor');
        expect(find.byType(BottomSheet), findsOneWidget, reason: 'con error la hoja queda abierta para reintentar');
        await shoot(tester, 'cfg_equipo_hoja_error${c.tag}');
      });

      testWidgets('invitar: formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, InviteScreen(roles: _team.roles), c);
        await shoot(tester, 'cfg_invitar${c.tag}');
        await _typeIn(tester, _field('Nombre (opcional)'), save: 'Enviar invitación');
        await shoot(tester, 'cfg_invitar_teclado_primero${c.tag}');
        await _typeIn(tester, _field('Email'), save: 'Enviar invitación');
        // Último campo: el mensaje del mail (varias líneas).
        await _typeIn(tester, find.byType(TextFormField).last, save: 'Enviar invitación');
        await shoot(tester, 'cfg_invitar_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el mensaje del mail');
        expectReachable(tester, _gold('Enviar invitación'), what: 'el botón Enviar invitación');
        await shoot(tester, 'cfg_invitar_fin${c.tag}');
      });

      testWidgets('invitar con 34 roles para elegir (${c.label})', (tester) async {
        final api = _Api();
        await _pumpCfg(tester, _Opener(InviteScreen(roles: _bigTeam.roles)), c, api: api, team: _bigTeam);
        await _open(tester);
        await shoot(tester, 'cfg_invitar_largo${c.tag}');
        await scrollToEnd(tester);
        await shoot(tester, 'cfg_invitar_largo_fin${c.tag}');
        await _typeIn(tester, find.byType(TextFormField).last, save: 'Enviar invitación');
        await closeKeyboard(tester);
        await tester.enterText(_field('Email'), 'nueva@x.com');
        await tester.pump();
        await tester.tap(_gold('Enviar invitación'));
        await settle(tester, 9);
        expect(api.calls.single.$1, 'invite');
        expect(find.byKey(const Key('abrir')), findsOneWidget, reason: 'vuelve al equipo');
        expect(find.text('Invitación enviada a nueva@x.com.'), findsOneWidget);
      });

      testWidgets('editor de roles: los 15 módulos, chips en una fila y cómodos (${c.label})', (tester) async {
        final role = _bigTeam.roles[2]; // nombre de 60 caracteres, no es de sistema
        await _pumpCfg(tester, RoleEditScreen(role: role, modules: _bigTeam.modules, canManage: true), c, team: _bigTeam);
        await shoot(tester, 'cfg_rol${c.tag}');
        await _typeIn(tester, _field('Nombre del rol'));
        await shoot(tester, 'cfg_rol_teclado${c.tag}');
        await closeKeyboard(tester);

        // Cada módulo: sus cuatro chips en la misma fila, dentro de la pantalla y de 44 dp o más.
        for (final m in _modules) {
          final card = find.ancestor(of: find.text(m.$2), matching: find.byType(Column)).first;
          await tester.ensureVisible(card);
          await tester.pump();
          final chips = find.descendant(of: card, matching: find.byType(PermToggle));
          expect(chips, findsNWidgets(4), reason: 'módulo ${m.$2}');
          final rects = [for (var i = 0; i < 4; i++) tester.getRect(chips.at(i))];
          for (final r in rects) {
            expect(r.left >= 0 && r.right <= currentPhone.width + 0.5, isTrue,
                reason: 'un chip de "${m.$2}" se sale de la pantalla ($r)');
            expect(r.height >= 44, isTrue, reason: 'chip de "${m.$2}" de ${r.height} dp de alto (mínimo 44)');
            expect((r.top - rects.first.top).abs() < 1, isTrue,
                reason: 'los permisos de "${m.$2}" tienen que quedar en una sola fila');
          }
          for (final a in ['Ver', 'Crear', 'Editar', 'Eliminar']) {
            expect(_lines(tester, find.descendant(of: card, matching: find.text(a))), 1,
                reason: '"$a" de "${m.$2}" en una línea');
          }
        }
        await tester.ensureVisible(find.text('Filamentos'));
        await settle(tester, 2);
        await shoot(tester, 'cfg_rol_matriz${c.tag}');

        await scrollToEnd(tester);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Borrar rol'), what: 'el botón Borrar rol');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');
        await shoot(tester, 'cfg_rol_fin${c.tag}');
      });

      testWidgets('editor de roles: marcar todo, guardar y borrar con confirmación (${c.label})', (tester) async {
        final role = _bigTeam.roles[2];
        final api = _Api();
        await _pumpCfg(tester, _Opener(RoleEditScreen(role: role, modules: _bigTeam.modules, canManage: true)), c,
            api: api, team: _bigTeam);
        await _open(tester);
        await tester.ensureVisible(find.text('Marcar todo'));
        await tester.pump();
        expect(tester.getSize(find.widgetWithText(TextButton, 'Marcar todo')).height >= 44, isTrue);
        await tester.tap(find.text('Marcar todo'));
        await settle(tester, 3);
        expectNoLayoutErrors(tester, 'con todos los permisos marcados');
        await shoot(tester, 'cfg_rol_todo${c.tag}');

        await scrollToEnd(tester);
        await tester.tap(find.widgetWithText(OutlinedButton, 'Borrar rol'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir la confirmación');
        final dialog = find.byType(AlertDialog);
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Borrar')), what: 'Borrar');
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Cancelar')), what: 'Cancelar');
        await shoot(tester, 'cfg_rol_borrar${c.tag}');
        await tester.tap(find.descendant(of: dialog, matching: find.text('Cancelar')));
        await settle(tester);
        expect(api.calls, isEmpty);

        await tester.tap(_gold('Guardar cambios'));
        await settle(tester, 9);
        final call = api.calls.single;
        expect(call.$1, 'role_update');
        final perms = (call.$2! as Map)['permissions'] as Map;
        expect(perms.keys, [for (final m in _modules) m.$1]);
        expect(perms.values.every((a) => (a as List).length == 4), isTrue);
        expect(find.byKey(const Key('abrir')), findsOneWidget);
        expect(find.text('Rol actualizado'), findsOneWidget);
      });

      testWidgets('rol nuevo, rol Administrador y rol visto por un no-administrador (${c.label})', (tester) async {
        await _pumpCfg(tester, RoleEditScreen(modules: _bigTeam.modules, canManage: true), c);
        expect(find.text('Borrar rol'), findsNothing);
        await shoot(tester, 'cfg_rol_nuevo${c.tag}');
        await _typeIn(tester, _field('Nombre del rol'), save: 'Crear rol');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expectReachable(tester, find.widgetWithText(PermToggle, 'Eliminar').last, what: 'el último permiso');
        expectReachable(tester, _gold('Crear rol'), what: 'el botón Crear rol');

        await _pumpCfg(tester, RoleEditScreen(role: _bigTeam.roles[0], modules: _bigTeam.modules, canManage: true), c);
        expect(find.text('El rol Administrador tiene acceso total y no se edita.'), findsOneWidget);
        expect(find.text('Guardar cambios'), findsNothing);
        await shoot(tester, 'cfg_rol_admin${c.tag}');

        await _pumpCfg(tester, RoleEditScreen(role: _bigTeam.roles[2], modules: _bigTeam.modules, canManage: false), c,
            me: _viewer);
        expect(find.text('Solo un administrador puede editar roles.'), findsOneWidget);
        expect(find.text('Guardar cambios'), findsNothing);
        expect(find.text('Borrar rol'), findsNothing);
        expect(find.text('Marcar todo'), findsNothing);
        await shoot(tester, 'cfg_rol_solo_ver${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.widgetWithText(PermToggle, 'Eliminar').last, what: 'el último permiso (solo lectura)');
        await shoot(tester, 'cfg_rol_solo_ver_fin${c.tag}');
      });
    }
  });

  // =========================================================================
  group('Configuración · textos clave', () {
    for (final c in _cases) {
      testWidgets('menú de textos (${c.label})', (tester) async {
        await _pumpCfg(tester, TextosScreen(initial: _config.textos, canEdit: true, canEditQuote: true), c);
        await shoot(tester, 'cfg_textos${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('Lo marcado "De fábrica"'), what: 'la nota del final');

        await _pumpCfg(tester, TextosScreen(initial: _bigConfig.textos, canEdit: true, canEditQuote: true), c);
        await shoot(tester, 'cfg_textos_largo${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('Lo marcado "De fábrica"'), what: 'la nota del final');

        await _pumpCfg(tester, TextosScreen(initial: _emptyConfig.textos, canEdit: false, canEditQuote: false), c,
            me: _viewer);
        await scrollToEnd(tester);
        expectReachable(tester, find.textContaining('Lo marcado "De fábrica"'), what: 'la nota del final');
      });

      testWidgets('banda de confianza: formulario con teclado (${c.label})', (tester) async {
        await _pumpCfg(tester, TrustBarScreen(initial: _bigConfig.textos.trustBar, canEdit: true), c);
        await shoot(tester, 'cfg_confianza${c.tag}');
        await _typeIn(tester, find.byType(TextFormField).first);
        await shoot(tester, 'cfg_confianza_teclado_primero${c.tag}');
        await _typeIn(tester, find.byType(TextFormField).last);
        await shoot(tester, 'cfg_confianza_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo');
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar');

        await _pumpCfg(tester, TrustBarScreen(initial: _config.textos.trustBar, canEdit: false), c, me: _viewer);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'el último campo (solo lectura)');
        await shoot(tester, 'cfg_confianza_solo_ver_fin${c.tag}');
      });

      testWidgets('preguntas frecuentes: 12 respuestas largas, cursor a la vista al escribir al final (${c.label})',
          (tester) async {
        final api = _Api();
        await _pumpCfg(tester, FaqScreen(initial: _bigConfig.textos.faq, canEdit: true), c, api: api);
        await shoot(tester, 'cfg_faq${c.tag}');
        expect(find.text('Agregar pregunta'), findsNothing, reason: 'con 12 ya no se pueden agregar más');

        await _typeIn(tester, find.byType(TextFormField).first);
        await shoot(tester, 'cfg_faq_teclado_primero${c.tag}');

        // Última respuesta: 600 caracteres. Se escribe al final.
        final last = find.byType(TextFormField).last;
        await openKeyboard(tester, last);
        final longText = _rep('Respuesta larga que se sigue escribiendo hasta el final del campo. ', 590);
        await tester.enterText(last, longText);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al escribir al final de una respuesta larga');
        _expectCaretVisible(tester, viewport: find.byType(SingleChildScrollView).first);
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar con el teclado abierto');
        await shoot(tester, 'cfg_faq_teclado_ultimo${c.tag}');
        // Una letra más: el cursor sigue a la vista.
        await tester.enterText(last, '$longText Fin.');
        await settle(tester, 4);
        _expectCaretVisible(tester, viewport: find.byType(SingleChildScrollView).first);
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        expectReachable(tester, last, what: 'la última respuesta');
        await shoot(tester, 'cfg_faq_fin${c.tag}');

        await tester.tap(_gold('Guardar cambios'));
        await settle(tester);
        final faq = (api.calls.single.$2! as Map)['faq'] as List;
        expect(faq, hasLength(12));
        expect((faq.last as Map)['a'], '$longText Fin.');
      });

      testWidgets('preguntas frecuentes: agregar deja la fila nueva a la vista; validación (${c.label})',
          (tester) async {
        await _pumpCfg(tester, FaqScreen(initial: _config.textos.faq, canEdit: true), c);
        final add = find.widgetWithText(OutlinedButton, 'Agregar pregunta');
        await tester.ensureVisible(add);
        await tester.pump();
        expect(tester.getSize(add).height >= 44, isTrue);
        await tester.tap(add);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al agregar una pregunta');
        await _typeIn(tester, find.byType(TextFormField).at(2));
        await tester.enterText(find.byType(TextFormField).at(2), '¿Hacen envíos a todo el país?');
        await tester.pump();
        await closeKeyboard(tester);
        await tester.tap(_gold('Guardar cambios'));
        await settle(tester);
        expect(find.text('Falta la respuesta.'), findsOneWidget);
        expect(find.text('Completá la pregunta y la respuesta, o quitá la fila.'), findsOneWidget);
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar con el error');
        await shoot(tester, 'cfg_faq_error${c.tag}');
        // Con el error en la barra y el teclado abierto, la respuesta que falta se puede escribir.
        await _typeIn(tester, find.byType(TextFormField).last);
        await shoot(tester, 'cfg_faq_error_teclado${c.tag}');
        await closeKeyboard(tester);

        // Sin ninguna pregunta: queda el botón de agregar, a la vista.
        await _pumpCfg(tester, FaqScreen(initial: const [], canEdit: true), c);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Agregar pregunta'), what: 'Agregar pregunta');
        await shoot(tester, 'cfg_faq_vacio${c.tag}');

        await _pumpCfg(tester, FaqScreen(initial: _bigConfig.textos.faq, canEdit: false), c, me: _viewer);
        expect(find.byTooltip('Quitar pregunta'), findsNothing);
        await scrollToEnd(tester);
        expectReachable(tester, find.byType(TextFormField).last, what: 'la última respuesta (solo lectura)');
        await shoot(tester, 'cfg_faq_solo_ver_fin${c.tag}');
      });

      testWidgets('cotización: 10 aclaraciones largas, cursor a la vista al escribir al final (${c.label})',
          (tester) async {
        final api = _Api();
        await _pumpCfg(tester, QuoteScreen(initial: _bigConfig.textos.quote, canEdit: true), c, api: api);
        await shoot(tester, 'cfg_cotizacion${c.tag}');
        await _typeIn(tester, _field('Encabezado'));
        await shoot(tester, 'cfg_cotizacion_teclado_primero${c.tag}');
        await _typeIn(tester, _field('Seña (%)'));
        await _typeIn(tester, _field('Texto de la seña'));

        final last = _field('Aclaración 10');
        await openKeyboard(tester, last);
        final longText = _rep('Aclaración que se sigue escribiendo hasta el final del campo. ', 590);
        await tester.enterText(last, longText);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al escribir al final de una aclaración larga');
        _expectCaretVisible(tester, viewport: find.byType(SingleChildScrollView).first);
        expectReachable(tester, _gold('Guardar cambios'), what: 'el botón Guardar con el teclado abierto');
        await shoot(tester, 'cfg_cotizacion_teclado_ultimo${c.tag}');
        await closeKeyboard(tester);

        await scrollToEnd(tester);
        expectReachable(tester, last, what: 'la última aclaración');
        expect(find.text('Agregar aclaración'), findsNothing, reason: 'con 10 ya no se pueden agregar más');
        await shoot(tester, 'cfg_cotizacion_fin${c.tag}');

        await tester.tap(_gold('Guardar cambios'));
        await settle(tester);
        final body = api.calls.single.$2! as Map<String, dynamic>;
        expect(body['depositPct'], 100);
        expect((body['notes'] as List), hasLength(10));
        expect((body['notes'] as List).last, longText.trim());
      });

      testWidgets('cotización: sin aclaraciones, agregar una, y solo lectura (${c.label})', (tester) async {
        await _pumpCfg(tester, QuoteScreen(initial: _emptyConfig.textos.quote, canEdit: true), c);
        await shoot(tester, 'cfg_cotizacion_vacio${c.tag}');
        final add = find.widgetWithText(OutlinedButton, 'Agregar aclaración');
        await tester.ensureVisible(add);
        await tester.pump();
        expectReachable(tester, add, what: 'Agregar aclaración');
        await tester.tap(add);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al agregar una aclaración');
        await _typeIn(tester, _field('Aclaración 1'));
        await shoot(tester, 'cfg_cotizacion_agregada${c.tag}');
        await closeKeyboard(tester);

        await _pumpCfg(tester, QuoteScreen(initial: _bigConfig.textos.quote, canEdit: false), c, me: _viewer);
        expect(find.textContaining('quien puede editar productos o pedidos'), findsOneWidget);
        expect(find.text('Guardar cambios'), findsNothing);
        await scrollToEnd(tester);
        expectReachable(tester, _field('Aclaración 10'), what: 'la última aclaración (solo lectura)');
        await shoot(tester, 'cfg_cotizacion_solo_ver_fin${c.tag}');
      });
    }
  });

  // =========================================================================
  group('Configuración · estados de guardado', () {
    testWidgets('mientras guarda el botón queda ocupado y no se puede mandar dos veces', (tester) async {
      const c = _Case(Phone.small);
      final api = _Api(hang: true);
      await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c, api: api);
      await tester.enterText(_field('Eslogan'), 'Otro');
      await tester.pump();
      await tester.tap(_gold('Guardar cambios'));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(find.byType(GoldButton), warnIfMissed: false);
      await tester.tap(find.byType(GoldButton), warnIfMissed: false);
      await tester.pump(const Duration(milliseconds: 100));
      expect(api.calls, hasLength(1), reason: 'tocar varias veces manda una sola vez');
      expect(find.descendant(of: find.byType(GoldButton), matching: find.byType(CircularProgressIndicator)), findsOneWidget);
      await shoot(tester, 'cfg_guardando');
    });

    testWidgets('validación: el campo con error queda a la vista aunque esté arriba', (tester) async {
      const c = _Case(Phone.small, 1.3);
      final api = _Api();
      await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c, api: api);
      await tester.enterText(_field('Nombre comercial'), ' ');
      await tester.pump();
      await scrollToEnd(tester);
      await tester.tap(_gold('Guardar cambios'));
      await settle(tester, 8);
      expect(api.calls, isEmpty);
      expectReachable(tester, find.text('Ingresá el nombre del negocio.'), what: 'el mensaje de error del campo');
      expectReachable(tester, find.text('Revisá los campos marcados.'), what: 'el aviso de la barra');
      await shoot(tester, 'cfg_negocio_validacion_grande');
    });
  });

  // =========================================================================
  group('Configuración · temas claro y luz nocturna', () {
    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      for (final phone in Phone.both) {
        final c = _Case(phone);
        testWidgets('menú, formularios y modales en ${mode.name} (${phone.name})', (tester) async {
          await _pumpCfg(tester, const AdminConfiguracionScreen(), c, theme: mode);
          await shoot(tester, 'cfg_menu_${mode.name}');

          await _pumpCfg(tester, NegocioScreen(initial: _config.negocio, canEdit: true), c, theme: mode);
          await scrollToEnd(tester);
          await shoot(tester, 'cfg_negocio_fin_${mode.name}');
          await tester.tap(find.widgetWithText(OutlinedButton, '09:00').last);
          await settle(tester, 8);
          expectNoLayoutErrors(tester, 'reloj en ${mode.name}');
          expectReachable(tester, find.text('Aceptar'), what: 'Aceptar del reloj');
          await shoot(tester, 'cfg_negocio_reloj_${mode.name}');

          await _pumpCfg(tester, TiendaScreen(initial: _config.tienda, canEdit: true), c, theme: mode);
          await shoot(tester, 'cfg_tienda_${mode.name}');
          await tester.ensureVisible(find.text('Decoración animada'));
          await settle(tester, 2);
          await shoot(tester, 'cfg_tienda_temporada_${mode.name}');
          await scrollToEnd(tester);
          await shoot(tester, 'cfg_tienda_fin_${mode.name}');

          await _pumpCfg(tester, BannerEditScreen(banner: _config.tienda.banners.first, canEdit: true), c, theme: mode);
          await tester.ensureVisible(find.text('Derecha'));
          await settle(tester, 2);
          await shoot(tester, 'cfg_banner_${mode.name}');
          await scrollToEnd(tester);
          await tester.tap(find.widgetWithText(OutlinedButton, 'Eliminar banner'));
          await settle(tester);
          expectNoLayoutErrors(tester, 'confirmación en ${mode.name}');
          await shoot(tester, 'cfg_banner_eliminar_${mode.name}');

          await _pumpCfg(
            tester,
            PagosScreen(
              initial: PagosConfig.fromJson({...(configJson()['pagos'] as Map<String, dynamic>), 'cashEnabled': true}),
              canEdit: true,
            ),
            c,
            theme: mode,
          );
          await shoot(tester, 'cfg_pagos_${mode.name}');
          await tester.ensureVisible(find.widgetWithText(TextButton, 'Conectar'));
          await tester.pump();
          await tester.tap(find.widgetWithText(TextButton, 'Conectar'));
          await settle(tester);
          await openKeyboard(tester, find.descendant(of: find.byType(AlertDialog), matching: find.byType(TextField)));
          expectFocusedFieldVisible(tester);
          await shoot(tester, 'cfg_pagos_token_${mode.name}');

          await _pumpCfg(tester, const EquipoScreen(), c, theme: mode);
          await shoot(tester, 'cfg_equipo_${mode.name}');
          await tester.tap(find.text('anto@x.com').first);
          await settle(tester);
          expectNoLayoutErrors(tester, 'hoja del miembro en ${mode.name}');
          await shoot(tester, 'cfg_equipo_hoja_${mode.name}');
          await tester.tap(find.text('Cambiar rol'));
          await settle(tester);
          await shoot(tester, 'cfg_equipo_elegir_rol_${mode.name}');

          await _pumpCfg(tester, RoleEditScreen(role: _team.roles[1], modules: _bigTeam.modules, canManage: true), c,
              theme: mode);
          await shoot(tester, 'cfg_rol_${mode.name}');

          await _pumpCfg(tester, FaqScreen(initial: _config.textos.faq, canEdit: true), c, theme: mode);
          await shoot(tester, 'cfg_faq_${mode.name}');

          await _pumpCfg(tester, EnviosScreen(initial: _config.envios, canEdit: true), c, theme: mode);
          await shoot(tester, 'cfg_envios_${mode.name}');

          await _pumpCfg(tester, _Opener(InviteScreen(roles: _team.roles)), c, theme: mode);
          await _open(tester);
          await tester.enterText(_field('Email'), 'a@b.com');
          await tester.pump();
          await tester.tap(find.byType(BackButton));
          await settle(tester);
          expectNoLayoutErrors(tester, 'cambios sin guardar en ${mode.name}');
          await shoot(tester, 'cfg_descartar_${mode.name}');
        });
      }
    }
  });

  // =========================================================================
  group('Auditoría · lista', () {
    for (final c in _cases) {
      testWidgets('lista con nombres largos y montos de 9 cifras (${c.label})', (tester) async {
        final api = _FakeAuditApi();
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api);
        expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
        expect(find.textContaining(r'Total: $123.456.789'), findsOneWidget);
        await shoot(tester, 'aud_lista${c.tag}');
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.byType(AuditTile).last, what: 'el último evento');
        // La baja de una cuenta (sin autor) se lee bien y en castellano.
        final gone = find.widgetWithText(AuditTile, 'Un cliente eliminó su cuenta');
        expect(gone, findsOneWidget);
        expect(find.descendant(of: gone, matching: find.text('El propio cliente')), findsOneWidget);
        expect(find.descendant(of: gone, matching: find.text('Cliente')), findsOneWidget);
        expect(find.descendant(of: gone, matching: find.text('Se conservaron sus pedidos: Sí')), findsOneWidget);
        await shoot(tester, 'aud_lista_fin${c.tag}');
      });

      testWidgets('buscar con el teclado abierto (${c.label})', (tester) async {
        final api = _FakeAuditApi();
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api);
        final search = find.byType(TextField);
        await openKeyboard(tester, search);
        expectFocusedFieldVisible(tester);
        await tester.enterText(search, 'pedido de la feria de artesanos del sábado pasado');
        await settle(tester, 7);
        expectNoLayoutErrors(tester, 'al buscar');
        expect(api.calls.last.$1.q, 'pedido de la feria de artesanos del sábado pasado');
        expectReachable(tester, find.byTooltip('Borrar búsqueda'), what: 'la cruz de borrar la búsqueda');
        expectReachable(tester, find.byTooltip('Filtros'), what: 'el botón de filtros');
        await shoot(tester, 'aud_buscar_teclado${c.tag}');
        expect(tester.getSize(find.byTooltip('Borrar búsqueda')).height >= 44, isTrue);
        await tester.tap(find.byTooltip('Borrar búsqueda'));
        await settle(tester, 6);
        expect(api.calls.last.$1.q, '');
        await closeKeyboard(tester);
      });

      testWidgets('la hoja de filtros (${c.label})', (tester) async {
        final api = _FakeAuditApi();
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api);
        await tester.tap(find.byTooltip('Filtros'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir los filtros');
        final sheet = find.byType(BottomSheet);
        expect(sheet, findsOneWidget);
        _expectInsideScreen(tester, sheet, 'la hoja de filtros');
        expectReachable(tester, _gold('Aplicar'), what: 'el botón Aplicar');
        expectReachable(tester, find.widgetWithText(TextButton, 'Limpiar'), what: 'el botón Limpiar');
        await shoot(tester, 'aud_filtros${c.tag}');

        await tester.tap(find.widgetWithText(ChoiceChip, 'Ale'));
        await tester.tap(find.widgetWithText(ChoiceChip, 'Últimos 7 días'));
        await tester.pump();
        await tester.tap(_gold('Aplicar'));
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al aplicar los filtros');
        expect(api.calls.last.$1.actor, 'u1');
        expect(api.calls.last.$1.period, AuditPeriod.week);
        expect(find.byType(BottomSheet), findsNothing);
        // Quedan como chips con su "x", dentro de la pantalla.
        expectReachable(tester, find.widgetWithText(InputChip, 'Ale'), what: 'el chip del filtro de persona');
        expectReachable(tester, find.widgetWithText(InputChip, 'Últimos 7 días'), what: 'el chip del período');
        await shoot(tester, 'aud_filtros_activos${c.tag}');
      });

      testWidgets('la hoja de filtros con 32 personas y 40 acciones (${c.label})', (tester) async {
        final api = _FakeAuditApi(pages: [_page(bigFacets: true)]);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api);
        await shoot(tester, 'aud_lista_muchos_tipos${c.tag}');
        await tester.tap(find.byTooltip('Filtros'));
        await settle(tester);
        expectNoLayoutErrors(tester, 'al abrir los filtros');
        final sheet = find.byType(BottomSheet);
        _expectInsideScreen(tester, sheet, 'la hoja de filtros');
        expect(tester.getRect(find.text('Filtros').last).top >= currentPhone.top, isTrue,
            reason: 'el título de la hoja no puede quedar debajo de la barra de estado');
        expectReachable(tester, _gold('Aplicar'), what: 'el botón Aplicar (fijo abajo)');
        expectReachable(tester, find.widgetWithText(TextButton, 'Limpiar'), what: 'el botón Limpiar');
        await shoot(tester, 'aud_filtros_largo${c.tag}');

        // Se desplaza hasta la última acción y el botón sigue fijo.
        final scroll = find.descendant(of: sheet, matching: find.byType(Scrollable)).first;
        await scrollToEnd(tester, scrollable: scroll);
        final lastAction = find.widgetWithText(ChoiceChip, 'Algo: nuevo sin traducir');
        expectReachable(tester, lastAction, what: 'la última acción');
        expectReachable(tester, _gold('Aplicar'), what: 'el botón Aplicar al final de la lista');
        await shoot(tester, 'aud_filtros_largo_fin${c.tag}');

        await tester.tap(lastAction);
        await tester.pump();
        await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Sistema'));
        await tester.pump();
        await tester.tap(find.widgetWithText(ChoiceChip, 'Sistema'));
        await tester.pump();
        await tester.tap(_gold('Aplicar'));
        await settle(tester, 8);
        expect(api.calls.last.$1.action, 'algo.nuevo_sin_traducir');
        expect(api.calls.last.$1.actor, 'sistema');
        expectNoLayoutErrors(tester, 'con los chips de filtros activos');
        await shoot(tester, 'aud_filtros_largo_activos${c.tag}');

        // Limpiar desde la hoja.
        await tester.tap(find.byTooltip('Filtros'));
        await settle(tester);
        await tester.tap(find.widgetWithText(TextButton, 'Limpiar'));
        await tester.pump();
        await tester.tap(_gold('Aplicar'));
        await settle(tester, 8);
        expect(api.calls.last.$1.hasChips, isFalse);
        expect(find.byType(InputChip), findsNothing);
      });

      testWidgets('vacío, sin resultados, error, sin acceso y cargando (${c.label})', (tester) async {
        final empty = _FakeAuditApi(pages: [AuditPage.fromJson(const {'items': <Object>[]})]);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: empty);
        expect(find.text('Todavía no hay registros'), findsOneWidget);
        await shoot(tester, 'aud_vacia${c.tag}');

        // Con una búsqueda sin resultados y el teclado abierto.
        await openKeyboard(tester, find.byType(TextField));
        await tester.enterText(find.byType(TextField), 'zzz');
        await settle(tester, 7);
        expectNoLayoutErrors(tester, 'sin resultados con el teclado abierto');
        expect(find.text('No hay registros con esos filtros'), findsOneWidget);
        await shoot(tester, 'aud_sin_resultados_teclado${c.tag}');
        await closeKeyboard(tester);
        expectReachable(tester, _gold('Limpiar filtros'), what: 'el botón Limpiar filtros');
        await shoot(tester, 'aud_sin_resultados${c.tag}');
        await tester.tap(_gold('Limpiar filtros'));
        await settle(tester, 6);
        expect(find.text('Todavía no hay registros'), findsOneWidget);

        final failing = _FakeAuditApi(fail: true);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: failing);
        expect(find.textContaining('No pudimos conectarnos'), findsOneWidget);
        expectReachable(tester, _gold('Reintentar'), what: 'el botón Reintentar');
        await shoot(tester, 'aud_error${c.tag}');
        failing.fail = false;
        await tester.tap(_gold('Reintentar'));
        await settle(tester);
        expect(find.text('Cambió el estado de un pedido'), findsOneWidget);

        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, me: _outsider);
        expect(find.text('Sin acceso'), findsOneWidget);
        await shoot(tester, 'aud_sin_acceso${c.tag}');

        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: _FakeAuditApi(hang: true));
        expect(find.byType(AuditTile), findsNothing);
        await shoot(tester, 'aud_cargando${c.tag}');
      });

      testWidgets('cargar más: 60 eventos, el indicador y el reintento quedan a la vista (${c.label})',
          (tester) async {
        // Dos páginas llenas.
        final api = _FakeAuditApi(pages: [_fullPage(1, hasMore: true), _fullPage(2, hasMore: false)]);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api);
        await scrollToEnd(tester, scrollable: _lastList());
        await settle(tester, 4);
        await scrollToEnd(tester, scrollable: _lastList());
        expect(api.calls.where((x) => x.$2 == 2), hasLength(1), reason: 'la página 2 se pide una sola vez');
        expect(api.calls.any((x) => x.$2 == 3), isFalse, reason: 'sin más páginas no pide la 3');
        expectReachable(tester, find.byType(AuditTile).last, what: 'el último evento de la página 2');
        await shoot(tester, 'aud_mas_fin${c.tag}');

        // La página 2 tarda: se ve el indicador al final, arriba de la barra del sistema.
        final slow = _FakeAuditApi(pages: [_fullPage(1, hasMore: true)], hangFromPage: 2);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: slow);
        await scrollToEnd(tester, scrollable: _lastList());
        expectReachable(tester, find.byType(CircularProgressIndicator), what: 'el indicador de "cargando más"');
        await shoot(tester, 'aud_mas_cargando${c.tag}');

        // La página 2 falla: mensaje + Reintentar a la vista.
        final broken = _FakeAuditApi(pages: [_fullPage(1, hasMore: true)], failFromPage: 2);
        await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: broken);
        await scrollToEnd(tester, scrollable: _lastList());
        await settle(tester, 4);
        await scrollToEnd(tester, scrollable: _lastList());
        expect(find.textContaining('No pudimos conectarnos'), findsOneWidget);
        final retry = find.widgetWithText(TextButton, 'Reintentar');
        expectReachable(tester, retry, what: 'el botón Reintentar de "cargar más"');
        expect(tester.getSize(retry).height >= 44, isTrue);
        await shoot(tester, 'aud_mas_error${c.tag}');
        expect(find.byType(AuditTile), findsWidgets, reason: 'lo que ya estaba cargado no se pierde');
      });
    }
  });

  // =========================================================================
  group('Auditoría · detalle', () {
    for (final c in _cases) {
      testWidgets('detalle con JSON largo y anidado: se desplaza, no desborda (${c.label})', (tester) async {
        final api = _FakeAuditApi();
        final entry = _page().items[2];
        await _pumpAudit(tester, AuditDetailScreen(entry: entry), c, api: api);
        expect(find.text('Editó un producto'), findsOneWidget);
        await shoot(tester, 'aud_detalle${c.tag}');
        await tester.scrollUntilVisible(find.text('Datos tal como se guardaron'), 250,
            scrollable: find.byType(Scrollable).first);
        await settle(tester, 2);
        await shoot(tester, 'aud_detalle_json${c.tag}');
        await scrollToEnd(tester);
        final json = tester.getRect(find.byType(SelectableText));
        expect(json.bottom <= safeRect.bottom + 0.5, isTrue,
            reason: 'el final del JSON (${json.bottom}) queda debajo de la barra del sistema (${safeRect.bottom})');
        await shoot(tester, 'aud_detalle_fin${c.tag}');

        // Nada se sale por los costados.
        for (final t in find.byType(RichText).evaluate()) {
          final box = t.renderObject! as RenderBox;
          if (!box.attached || !box.hasSize) continue;
          final r = box.localToGlobal(Offset.zero) & box.size;
          expect(r.left >= -0.5 && r.right <= currentPhone.width + 0.5, isTrue,
              reason: 'un texto del detalle se sale de la pantalla: $r');
        }
      });

      testWidgets('copiar un dato: botón cómodo y aviso (${c.label})', (tester) async {
        final entry = _page().items[2];
        await _pumpAudit(tester, AuditDetailScreen(entry: entry), c);
        final copy = find.byTooltip('Copiar');
        void comfortable() {
          expect(copy, findsWidgets);
          for (final e in copy.evaluate()) {
            final size = (e.renderObject! as RenderBox).size;
            expect(size.width >= 44 && size.height >= 44, isTrue, reason: 'botón de copiar de $size (mínimo 44 dp)');
          }
        }

        // Arriba: el identificador de la entidad.
        comfortable();
        await tester.tap(copy.first);
        await settle(tester, 4);
        expectNoLayoutErrors(tester, 'al copiar');
        expect(find.text('Copiado'), findsOneWidget);
        await shoot(tester, 'aud_detalle_copiado${c.tag}');
        // Abajo: el código de la acción y el id del evento.
        await tester.scrollUntilVisible(find.text('Id del evento'), 250, scrollable: find.byType(Scrollable).first);
        await settle(tester, 2);
        expect(copy, findsAtLeastNWidgets(2));
        comfortable();
      });

      testWidgets('evento del sistema sin datos, texto suelto y persona de nombre larguísimo (${c.label})',
          (tester) async {
        final items = _page().items;
        final sys = AuditEntry.fromJson(_ev('${_uuid}e099', 'inventory.order_deduct_failed', _ago(0, 3), entity: 'order', actor: null));
        await _pumpAudit(tester, AuditDetailScreen(entry: sys), c, api: _FakeAuditApi(fail: true));
        expect(find.text('Sistema'), findsOneWidget);
        await shoot(tester, 'aud_detalle_sistema${c.tag}');
        await scrollToEnd(tester);
        expect(find.text('Este evento no guardó más datos.'), findsOneWidget);
        expectReachable(tester, find.text('Id del evento'), what: 'la última fila');

        // Baja de cuenta desde la app: sin autor, pero no la hizo "el sistema".
        await _pumpAudit(tester, AuditDetailScreen(entry: items[7]), c, api: _FakeAuditApi(fail: true));
        expect(find.text('Un cliente eliminó su cuenta'), findsOneWidget);
        expect(find.text('El propio cliente'), findsOneWidget);
        expect(find.text('Sistema'), findsNothing);
        expect(find.text('Cliente'), findsOneWidget, reason: 'el tipo "customer" va en castellano');
        await shoot(tester, 'aud_detalle_baja_cuenta${c.tag}');
        await scrollToEnd(tester);
        expect(find.text('Se conservaron sus pedidos'), findsOneWidget);
        expect(find.textContaining('Orders'), findsNothing, reason: 'nada en inglés');
        expectReachable(tester, find.text('Id del evento'), what: 'la última fila');

        await _pumpAudit(tester, AuditDetailScreen(entry: items[4]), c);
        await shoot(tester, 'aud_detalle_persona_larga${c.tag}');
        await scrollToEnd(tester);

        await _pumpAudit(tester, AuditDetailScreen(entry: items[5]), c);
        expect(find.text('Algo: nuevo sin traducir con un codigo bastante largo'), findsOneWidget);
        await shoot(tester, 'aud_detalle_desconocido${c.tag}');
        await scrollToEnd(tester);
        expectReachable(tester, find.text('Id del evento'), what: 'la última fila');

        await _pumpAudit(tester, AuditDetailScreen(entry: items[6]), c);
        await scrollToEnd(tester);
        expect(find.text('texto suelto, no un objeto'), findsOneWidget);
        await shoot(tester, 'aud_detalle_texto_fin${c.tag}');
      });
    }

    testWidgets('desde la lista: tocar un evento abre su detalle', (tester) async {
      await _pumpAudit(tester, const AdminAuditoriaScreen(), const _Case(Phone.small));
      await tester.tap(find.text('Cargó una venta manual'));
      await settle(tester, 8);
      expectNoLayoutErrors(tester);
      expect(find.text('Detalle del evento'), findsOneWidget);
      expect(find.text(r'$123.456.789'), findsOneWidget);
    });
  });

  // =========================================================================
  group('Auditoría · temas claro y luz nocturna', () {
    for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
      for (final phone in Phone.both) {
        final c = _Case(phone);
        testWidgets('lista, filtros y detalle en ${mode.name} (${phone.name})', (tester) async {
          final api = _FakeAuditApi(pages: [_page(bigFacets: true)]);
          await _pumpAudit(tester, const AdminAuditoriaScreen(), c, api: api, theme: mode);
          await shoot(tester, 'aud_lista_${mode.name}');
          await tester.tap(find.byTooltip('Filtros'));
          await settle(tester);
          expectNoLayoutErrors(tester, 'filtros en ${mode.name}');
          expectReachable(tester, _gold('Aplicar'), what: 'el botón Aplicar');
          await tester.tap(find.widgetWithText(ChoiceChip, 'Hoy'));
          await tester.pump();
          await shoot(tester, 'aud_filtros_${mode.name}');

          await _pumpAudit(tester, AuditDetailScreen(entry: _page().items[2]), c, theme: mode);
          await shoot(tester, 'aud_detalle_${mode.name}');
          await scrollToEnd(tester);
          await shoot(tester, 'aud_detalle_fin_${mode.name}');
        });
      }
    }
  });
}
