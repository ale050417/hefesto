// Pruebas "teléfono real" del grupo CRECIMIENTO del panel (2026-11-14, pedido
// de Ale: que ninguna pantalla ni modal se vea roto en el celular): Clientes
// (lista, ficha, alta), Descuentos (lista de cupones, formulario) y
// Recompensas (pantalla, formulario), más las piezas de
// `crecimiento/form_kit.dart` (confirmación, selector de opciones, barra de
// guardar).
//
// Cada cosa se dibuja en el teléfono más chico (360×640 con barra de tres
// botones) y en un iPhone con notch, y otra vez en el chico con letra 1,3×.
// Los formularios, con el teclado abierto en el primer y en el último campo;
// los modales se abren por el camino real (tocando el botón de la pantalla).
// Un tema claro y uno cálido por módulo.
// Con SHOT_DIR=carpeta guarda una captura de cada paso.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/clientes/cliente_detail_screen.dart';
import 'package:hefesto/features/admin/clientes/clientes_screen.dart';
import 'package:hefesto/features/admin/crecimiento/form_kit.dart';
import 'package:hefesto/features/admin/descuentos/descuentos_screen.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_screen.dart';
import 'package:hefesto/features/admin/recompensas/recompensas_widgets.dart';

import 'admin_crecimiento_harness.dart' show FakeApi;
import 'admin_crecimiento_samples.dart';
import 'support/device_kit.dart';

// ---------------------------------------------------------------------------
// Datos de ejemplo (misma forma que devuelve /api/v1/admin/*). Los normales
// salen de `admin_crecimiento_samples.dart`; acá van los extremos.
// ---------------------------------------------------------------------------

typedef _Json = Map<String, dynamic>;

final _me = staffWith(['clientes', 'pedidos', 'descuentos', 'recompensas']);

const _nombreLargo = 'María de los Ángeles Fernández de la Fuente y Rodríguez Etcheverry Saavedra';
const _productoLargo =
    'Mate imperial de calabaza forrado en cuero con virola de alpaca cincelada y bombilla pico de loro';
const _tituloLargo = '15% de descuento en toda la tienda, sin tope de compra, acumulable con otras '
    'promociones y válido también para pedidos personalizados a medida';
const _errorServidor = 'No pudimos completar la operación. Probá de nuevo en unos segundos.';

String _uuid(int n) => '00000000-0000-4000-8000-${n.toString().padLeft(12, '0')}';
String _producto(int i) => i.isEven ? '$_productoLargo · modelo $i' : 'Llavero $i';

const _ultimoCliente = 'Último cliente de la lista';

/// GET /admin/clientes con 34 clientes: nombres larguísimos, montos de 9
/// cifras y contactos nulos.
_Json _muchosClientes() {
  const n = 34;
  return {
    'items': [
      for (var i = 0; i < n; i++)
        {
          'id': _uuid(i + 1),
          'source': i % 4 == 3 ? 'manual' : 'registered',
          'name': i == n - 1 ? _ultimoCliente : (i.isEven ? '$_nombreLargo $i' : 'Cliente $i'),
          'email': i % 3 == 0
              ? 'correo.larguisimo.de.prueba.numero.$i@un-dominio-interminable-de-ejemplo.com.ar'
              : null,
          'phone': i % 3 == 1 ? '+54 9 3757 62-41${(i % 100).toString().padLeft(2, '0')}' : null,
          'city': i.isEven ? 'San Fernando del Valle de Catamarca' : null,
          'note': null,
          'since': '2026-0${1 + i % 9}-10T12:00:00.000Z',
          'orders': i == 0 ? 123456 : i,
          'spent': i == 0 ? 987654321.5 : i * 1500.0,
          'tier': const ['gold', 'silver', 'bronze'][i % 3],
        },
    ],
    'total': n,
    'counts': {'all': n, 'gold': 12, 'silver': 11, 'bronze': 11},
    'totalSpent': 9876543210.0,
    'tiers': sampleCustomersJson()['tiers'],
  };
}

final _idExtremo = _uuid(900);

const _estados = [
  'pending_payment', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled', 'refunded',
];

/// GET /admin/clientes/:id de un cliente con 50 pedidos, 12 canjes, nota
/// larga y números enormes.
_Json _fichaExtrema() => {
      'customer': {
        'id': _idExtremo,
        'source': 'registered',
        'name': _nombreLargo,
        'email': 'correo.larguisimo.de.prueba@un-dominio-interminable-de-ejemplo.com.ar',
        'phone': '+54 9 3757 62-4148',
        'city': 'San Fernando del Valle de Catamarca',
        'note': 'Nota larga del taller sobre el cliente. ' * 12,
        'since': '2024-02-01T12:00:00.000Z',
        'orders': 123456,
        'spent': 987654321,
        'tier': 'gold',
      },
      'orders': [
        for (var i = 0; i < 50; i++)
          {
            'id': 'o$i',
            'orderNumber': 'HF-${10000 + i}',
            'status': _estados[i % _estados.length],
            'total': i == 0 ? 987654321 : 12500.5 * i,
            'createdAt': '2026-${(1 + i % 12).toString().padLeft(2, '0')}-12T10:00:00.000Z',
          },
      ],
      'points': {
        'balance': 123456789,
        'earned': 987654321,
        'redeemed': 864197532,
        'redemptions': [
          for (var i = 0; i < 12; i++)
            {
              'id': 'p$i',
              'reason': 'Canje: $_tituloLargo · cupón PREMIO-AB12$i',
              'points': 150000 + i,
              'createdAt': '2026-10-${10 + i}T10:00:00.000Z',
            },
        ],
      },
    };

/// GET /admin/clientes/:id de un cliente manual sin ningún dato de contacto.
_Json _fichaManualVacia() => {
      'customer': {
        'id': idFeria,
        'source': 'manual',
        'name': 'Li',
        'email': null,
        'phone': null,
        'city': null,
        'note': null,
        'since': '2026-09-10T09:00:00.000Z',
        'orders': 0,
        'spent': 0,
        'tier': 'bronze',
      },
      'orders': <dynamic>[],
    };

const _ultimoCupon = 'ULTIMO-CUPON-CON-UN-CODIGO-LARGUISIMO-DE-PRUEBA-2027';
const _cuponExtremo = 'CODIGOLARGUISIMODEPRUEBA4';

/// GET /admin/descuentos con 32 cupones. El último (índice 31) está pausado
/// y aplica a una categoría; el de índice 4 junta todos los extremos.
_Json _muchosCupones() {
  const n = 32;
  return {
    'items': [
      for (var i = 0; i < n; i++)
        () {
          final status = const ['active', 'paused', 'expired'][i % 3];
          final scoped = i % 3 != 0;
          return <String, dynamic>{
            'id': _uuid(100 + i),
            'code': i == n - 1 ? _ultimoCupon : (i.isEven ? 'CODIGOLARGUISIMODEPRUEBA$i' : 'CUPON$i'),
            'description': i % 3 == 0 ? '$_tituloLargo ($i)' : null,
            'type': i.isEven ? 'fixed' : 'percentage',
            'value': i.isEven ? (i == 0 ? 987654321 : 2000 + i) : 12.5,
            'minPurchase': i % 4 == 0 ? 123456789 : 0,
            'scope': scoped ? (i.isEven ? 'product' : 'category') : 'all',
            'targetId': scoped ? _uuid(500 + i) : null,
            'targetLabel': scoped ? '$_productoLargo · modelo $i' : null,
            'birthdayOnly': i % 5 == 0,
            'maxUses': i.isEven ? 100000 : null,
            'usedCount': i.isEven ? 99999 : i,
            'startsAt': null,
            'expiresAt': status == 'expired'
                ? '2026-0${1 + i % 9}-15T00:00:00.000Z'
                : (i.isEven ? '2027-0${1 + i % 9}-15T00:00:00.000Z' : null),
            'isActive': status != 'paused',
            'status': status,
            'createdAt': '2026-10-01T00:00:00.000Z',
          };
        }(),
    ],
    'counts': {'total': n, 'active': 11, 'paused': 11, 'expired': 10, 'uses': 123456789},
  };
}

/// GET /admin/descuentos/opciones con 40 productos y 32 categorías.
_Json _muchasOpciones() => {
      'products': [
        for (var i = 0; i < 40; i++) {'id': _uuid(500 + i), 'name': _producto(i)},
      ],
      'categories': [
        for (var i = 0; i < 32; i++)
          {
            'id': _uuid(700 + i),
            'name': i.isEven
                ? 'Categoría de nombre larguísimo para probar el recorte en dos renglones $i'
                : 'Categoría $i',
          },
      ],
    };

const _primeraRecompensa = '$_tituloLargo (0)';
const _ultimaRecompensa = '$_tituloLargo (la última)';
const _ultimoCanje = 'Cliente 29';

/// GET /admin/recompensas con 32 recompensas, 40 productos y 30 canjes. La
/// última (índice 31) es un descuento activo con un título larguísimo.
_Json _muchasRecompensas() {
  const n = 32;
  return {
    'program': {'pointsPerAmount': 100, 'moneyPerPoint': 1},
    'stats': {'inCirculation': 987654321, 'redemptions': 123456789, 'pointsRedeemed': 876543210},
    'rewards': [
      for (var i = 0; i < n; i++)
        {
          'id': _uuid(200 + i),
          'type': const ['shipping', 'discount', 'product'][i % 3],
          'title': i == n - 1 ? _ultimaRecompensa : (i.isEven ? '$_tituloLargo ($i)' : 'Premio $i'),
          'description': i % 4 == 0
              ? 'Descripción larga de la recompensa para probar el recorte en dos renglones ($i)'
              : null,
          'costPoints': i == 0 ? 123456789 : 100 * (i + 1),
          'discountValue': i % 3 == 1 ? (i.isEven ? 987654321 : 12.5) : null,
          'discountIsPercent': i % 3 == 1 && i.isOdd,
          'productId': i % 3 == 2 ? _uuid(500 + i) : null,
          'productName': i % 3 == 2 ? _producto(i) : null,
          'isActive': i % 5 != 0,
          'createdAt': '2026-09-01T10:00:00.000Z',
        },
    ],
    'products': [
      for (var i = 0; i < 40; i++) {'id': _uuid(500 + i), 'name': _producto(i)},
    ],
    'recentRedemptions': [
      for (var i = 0; i < 30; i++)
        {
          'id': 't$i',
          'customerId': _uuid(i + 1),
          'customerName': i % 4 == 0 ? null : (i.isEven ? _nombreLargo : 'Cliente $i'),
          'reason': i.isEven ? 'Canje: $_tituloLargo · cupón PREMIO-AB12C' : 'Canje: Envío gratis',
          'points': i == 0 ? 123456789 : 300 + i,
          'createdAt': '2026-10-${(1 + i % 28).toString().padLeft(2, '0')}T15:00:00.000Z',
        },
    ],
  };
}

// ---------------------------------------------------------------------------
// Servidor de mentira y arranque de cada pantalla
// ---------------------------------------------------------------------------

/// Responde los GET por ruta (los providers reales le pegan a esta API, así
/// también se prueba que la lista se vuelva a pedir después de guardar).
FakeApi _fake({
  Map<String, _Json Function()> get = const {},
  _Json Function(String method, String path, Object? body)? onSend,
}) =>
    FakeApi(
      onSend: onSend,
      onGet: (path) {
        final answer = get[path];
        if (answer == null) throw ApiException('not_found', 'Ruta no simulada: $path', status: 404);
        return answer();
      },
    );

/// El servidor no responde: toda lectura falla con su mensaje.
FakeApi _caido() => FakeApi(onGet: (_) => throw ApiException('unavailable', _errorServidor, status: 503));

List<Override> _api(FakeApi api) => [apiClientProvider.overrideWithValue(api)];

/// Teléfono + tamaño de letra de una pasada. `tag` va al nombre de la captura.
typedef _Modo = ({Phone phone, double letra, String tag});

const List<_Modo> _modos = [
  (phone: Phone.small, letra: 1.0, tag: ''),
  (phone: Phone.iphone, letra: 1.0, tag: ''),
  (phone: Phone.small, letra: 1.3, tag: '_grande'),
];

/// Un tema claro y uno cálido por módulo.
const _temas = [
  (phone: Phone.small, theme: HefestoThemeMode.light, tag: '_claro'),
  (phone: Phone.iphone, theme: HefestoThemeMode.warm, tag: '_calido'),
];

/// Registra [body] una vez por teléfono chico, iPhone y chico con letra 1,3×.
void _enCadaTelefono(String what, Future<void> Function(WidgetTester tester, _Modo m) body) {
  for (final m in _modos) {
    final letra = m.letra == 1 ? '' : ' con letra 1,3×';
    testWidgets('$what · ${m.phone.name}$letra', (tester) => body(tester, m));
  }
}

Future<void> _abrir(
  WidgetTester tester,
  _Modo m,
  Widget screen, {
  MeInfo? me,
  List<Override> overrides = const [],
  RouterConfig<Object>? router,
  HefestoThemeMode theme = HefestoThemeMode.dark,
}) =>
    pumpPhone(
      tester,
      screen,
      phone: m.phone,
      theme: theme,
      textScale: m.letra,
      me: me ?? _me,
      overrides: overrides,
      router: router,
    );

Future<void> _foto(WidgetTester tester, _Modo m, String name) => shoot(tester, '$name${m.tag}');

/// La ficha del cliente navega con go_router al tocar un pedido.
GoRouter _rutaFicha(String id) => GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => CustomerDetailScreen(customerId: id)),
        GoRoute(
          path: '/admin/venta/:source/:id',
          builder: (_, s) => Scaffold(
            appBar: AppBar(title: Text('Venta ${s.pathParameters['source']} ${s.pathParameters['id']}')),
          ),
        ),
      ],
    );

// ---------------------------------------------------------------------------
// Buscadores y verificaciones
// ---------------------------------------------------------------------------

/// La lista vertical de la pantalla (o de [dentroDe], p. ej. una hoja). No es
/// "el primer Scrollable": antes vienen el buscador y la fila de filtros.
Finder _lista({Finder? dentroDe}) {
  final all = find.byWidgetPredicate((w) => w is Scrollable && w.axisDirection == AxisDirection.down);
  return (dentroDe == null ? all : find.descendant(of: dentroDe, matching: all)).first;
}

Finder _enBarra(String title) => find.descendant(of: find.byType(AppBar), matching: find.text(title));

/// Texto del aviso fijo que va arriba del botón de guardar.
Finder _enGuardar(String text) => find.descendant(of: find.byType(SaveBar), matching: find.text(text));

/// El botón de tipo [T] que lleva ese rótulo.
Finder _boton<T extends Widget>(String label) =>
    find.ancestor(of: find.text(label), matching: find.byWidgetPredicate((w) => w is T)).first;

/// En cuántos renglones quedó dibujado un texto.
int _renglones(WidgetTester tester, Finder text) {
  final p = tester.renderObject<RenderParagraph>(text);
  final boxes = p.getBoxesForSelection(
    TextSelection(baseOffset: 0, extentOffset: p.text.toPlainText().length),
  );
  return boxes.map((b) => b.top.round()).toSet().length;
}

/// Cada elemento mide al menos 44 dp de lado (se puede tocar con el dedo).
void _expectTocable(WidgetTester tester, Finder finder, String what) {
  expect(finder, findsWidgets, reason: 'no se encontró $what');
  for (final e in finder.evaluate()) {
    final s = (e.renderObject! as RenderBox).size;
    expect(
      s.height >= 43.5 && s.width >= 43.5,
      isTrue,
      reason: '$what mide ${s.width.round()}×${s.height.round()} dp: menos de 44 dp, cuesta tocarlo',
    );
  }
}

/// [cover] (el botón flotante) no pisa a [item] (la última fila).
void _expectSinTapar(WidgetTester tester, Finder item, Finder cover, String what) {
  expect(
    tester.getRect(item).overlaps(tester.getRect(cover)),
    isFalse,
    reason: 'el botón flotante tapa $what',
  );
}

/// La hoja abierta no se mete debajo de la barra de estado / notch.
void _expectHojaEnPantalla(WidgetTester tester, String what) {
  final sheet = find.byType(BottomSheet);
  expect(sheet, findsOneWidget, reason: 'tendría que estar abierta $what');
  expect(
    tester.getRect(sheet).top >= currentPhone.top - 0.5,
    isTrue,
    reason: '$what se mete debajo de la barra de estado',
  );
}

/// Espera (máximo 2 s) a que la lista termine de desplazarse sola.
Future<void> _esperarQuieta(WidgetTester tester, Finder scrollable) async {
  for (var i = 0; i < 20; i++) {
    if (tester.state<ScrollableState>(scrollable).position.activity is IdleScrollActivity) return;
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Desplaza la lista hasta que [target] exista (las listas largas arman las
/// filas de a poco) y lo deja a la vista. `alignment` 0 = arriba, 1 = abajo.
Future<void> _llevarALaVista(
  WidgetTester tester,
  Finder target, {
  Finder? scrollable,
  double alignment = 0,
}) async {
  final state = tester.state<ScrollableState>(scrollable ?? _lista());
  // `find.x().first` LANZA (en vez de no encontrar nada) mientras la fila
  // todavía no se armó porque está más abajo: eso cuenta como "todavía no".
  bool missing() {
    try {
      return target.evaluate().isEmpty;
    } on StateError {
      return true;
    }
  }

  if (missing()) {
    state.position.jumpTo(0);
    await tester.pump(const Duration(milliseconds: 50));
  }
  for (var i = 0; i < 200 && missing(); i++) {
    final pos = state.position;
    if (pos.pixels >= pos.maxScrollExtent - 0.5) break;
    pos.jumpTo(math.min(pos.pixels + 120, pos.maxScrollExtent));
    await tester.pump(const Duration(milliseconds: 50));
  }
  expect(target, findsOneWidget, reason: 'no apareció ni desplazando la pantalla');
  await Scrollable.ensureVisible(tester.element(target), alignment: alignment);
  await settle(tester, 3);
}

/// Toca fuera del modal (arriba a la izquierda, sobre la barrera).
Future<void> _tocarAfuera(WidgetTester tester) async {
  await tester.tapAt(Offset(12, currentPhone.top + 12));
  await settle(tester, 6);
}

/// Deja que se vaya el aviso flotante (tapa unos segundos el pie de la lista).
Future<void> _esperarAviso(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 5));
  await settle(tester, 4);
}

/// Confirmación abierta (`confirmAction`): sin desbordes y con sus dos botones
/// a la vista. Devuelve el botón que confirma.
Finder _expectConfirmacion(WidgetTester tester, String confirmLabel) {
  expectNoLayoutErrors(tester, 'al abrir la confirmación');
  final confirm = _boton<FilledButton>(confirmLabel);
  expectReachable(tester, confirm, what: 'el botón "$confirmLabel" de la confirmación');
  expectReachable(tester, _boton<TextButton>('Cancelar'), what: 'el botón "Cancelar" de la confirmación');
  return confirm;
}

/// Selector de opciones (hoja con buscador) ya abierto: título y cruz a la
/// vista, última opción arriba de la barra de gestos, buscador con el teclado
/// abierto y elección de un resultado.
Future<void> _probarSelector(
  WidgetTester tester,
  _Modo m,
  String foto, {
  required String titulo,
  required String ultima,
  required String buscar,
  required String elegir,
}) async {
  final sheet = find.byType(BottomSheet);
  expectNoLayoutErrors(tester, 'al abrir el selector');
  await _foto(tester, m, foto);
  _expectHojaEnPantalla(tester, 'el selector');
  expectReachable(
    tester,
    find.descendant(of: sheet, matching: find.text(titulo)),
    what: 'el título del selector',
  );
  final close = find.descendant(of: sheet, matching: find.byTooltip('Cerrar'));
  expectReachable(tester, close, what: 'la cruz de cerrar el selector');
  expectReachable(
    tester,
    find.descendant(of: sheet, matching: find.byType(ListTile)).first,
    what: 'la primera opción del selector',
  );
  await scrollToEnd(tester, scrollable: _lista(dentroDe: sheet));
  expectReachable(
    tester,
    find.descendant(of: sheet, matching: find.text(ultima)),
    what: 'la última opción del selector',
  );
  await _foto(tester, m, '${foto}_fin');

  final search = find.descendant(of: sheet, matching: find.byType(TextField));
  await openKeyboard(tester, search);
  expectFocusedFieldVisible(tester);
  _expectHojaEnPantalla(tester, 'el selector con el teclado abierto');
  expectReachable(tester, close, what: 'la cruz de cerrar con el teclado abierto');
  await _foto(tester, m, '${foto}_teclado');
  await tester.enterText(search, 'no existe nada así');
  await settle(tester, 3);
  expectReachable(tester, find.text('Sin resultados.'), what: 'el aviso de búsqueda sin resultados');
  await tester.enterText(search, buscar);
  await settle(tester, 3);
  final result = find.descendant(of: sheet, matching: find.text(elegir));
  expectReachable(tester, result, what: 'el resultado de la búsqueda');
  await _foto(tester, m, '${foto}_resultado');
  await tester.tap(result);
  await closeKeyboard(tester);
  await settle(tester, 6);
  expect(sheet, findsNothing, reason: 'al elegir una opción se cierra el selector');
}

void main() {
  setUpAll(setUpDeviceKit);

  // =========================================================================
  group('Clientes', () {
    _enCadaTelefono('lista larga, filtros, buscador con teclado y hoja de niveles', (tester, m) async {
      final api = _fake(get: {'/admin/clientes': _muchosClientes});
      await _abrir(tester, m, const AdminClientesScreen(), overrides: _api(api));
      await _foto(tester, m, 'cli_lista');
      expectReachable(tester, _enBarra('Clientes'), what: 'el título de la pantalla');
      final fab = find.byType(FloatingActionButton);
      expectReachable(tester, fab, what: 'el botón "Nuevo cliente"');
      expect(_renglones(tester, find.text('Nuevo cliente')), 1, reason: 'el rótulo del botón va en un renglón');
      _expectTocable(tester, find.byType(ChoiceChip), 'cada filtro de nivel');

      await scrollToEnd(tester, scrollable: _lista());
      await _foto(tester, m, 'cli_lista_fin');
      final last = find.widgetWithText(CustomerTile, _ultimoCliente);
      expectReachable(tester, last, what: 'el último cliente');
      _expectSinTapar(tester, last, fab, 'el último cliente');

      // Buscador con el teclado abierto.
      final search = find.byType(TextField);
      await openKeyboard(tester, search);
      expectFocusedFieldVisible(tester);
      await tester.enterText(search, 'zzzz');
      await settle(tester, 3);
      expectNoLayoutErrors(tester, 'sin resultados con el teclado abierto');
      expect(find.text('No se encontraron clientes'), findsOneWidget);
      await _foto(tester, m, 'cli_buscar_vacio');
      await tester.enterText(search, 'catamarca');
      await settle(tester, 3);
      expect(find.byType(CustomerTile), findsWidgets);
      expectReachable(tester, find.byTooltip('Borrar búsqueda'), what: 'la cruz de borrar la búsqueda');
      await _foto(tester, m, 'cli_buscar');
      await closeKeyboard(tester);

      // Hoja "Niveles de cliente" (ícono de información de la barra).
      await tester.tap(find.byTooltip('Cómo se calculan los niveles'));
      await settle(tester, 6);
      expectNoLayoutErrors(tester, 'al abrir la hoja de niveles');
      await _foto(tester, m, 'cli_niveles');
      _expectHojaEnPantalla(tester, 'la hoja de niveles');
      expectReachable(tester, find.text('Niveles de cliente'), what: 'el título de la hoja');
      expectReachable(tester, find.text('Clientes recién llegados'), what: 'el último nivel de la hoja');
      expect(find.textContaining(r'$150.000'), findsOneWidget, reason: 'muestra los umbrales del servidor');
      await _tocarAfuera(tester);
      expect(find.text('Niveles de cliente'), findsNothing, reason: 'la hoja se cierra tocando afuera');
    });

    _enCadaTelefono('lista vacía, error y sin permiso', (tester, m) async {
      await _abrir(
        tester,
        m,
        const AdminClientesScreen(),
        overrides: _api(_fake(get: {'/admin/clientes': () => {'items': <dynamic>[]}})),
      );
      expectReachable(tester, find.text('Todavía no hay clientes'), what: 'el aviso de lista vacía');
      expectReachable(tester, find.byType(FloatingActionButton), what: 'el botón de alta');
      await _foto(tester, m, 'cli_vacio');

      await _abrir(tester, m, const AdminClientesScreen(), overrides: _api(_caido()));
      expect(find.text(_errorServidor), findsOneWidget);
      expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón de reintentar');
      await _foto(tester, m, 'cli_error');
      // La hoja de niveles sin los umbrales del servidor describe cada nivel.
      await tester.tap(find.byTooltip('Cómo se calculan los niveles'));
      await settle(tester, 6);
      expect(find.text('Clientes recién llegados'), findsOneWidget, reason: 'solo el nivel "Nuevo"');
      await _tocarAfuera(tester);

      await _abrir(
        tester,
        m,
        const AdminClientesScreen(),
        me: staffWith(['clientes'], actions: const []),
        overrides: _api(_caido()),
      );
      expectReachable(tester, find.text('Sin acceso'), what: 'el aviso de sin acceso');
      expect(find.byType(FloatingActionButton), findsNothing);
      await _foto(tester, m, 'cli_sin_acceso');
    });

    _enCadaTelefono('ficha: contacto, pedido, final de la pantalla y nota con teclado', (tester, m) async {
      final api = _fake(get: {'/admin/clientes/$idJuan': sampleCustomerDetailJson});
      await _abrir(tester, m, const SizedBox.shrink(), overrides: _api(api), router: _rutaFicha(idJuan));
      await _foto(tester, m, 'cli_ficha');
      final wa = _boton<FilledButton>('WhatsApp');
      final call = _boton<OutlinedButton>('Llamar');
      expectReachable(tester, wa, what: 'el botón de WhatsApp');
      expectReachable(tester, call, what: 'el botón de llamar');
      expect(_renglones(tester, find.text('WhatsApp')), 1, reason: '"WhatsApp" va en un renglón');
      expect(_renglones(tester, find.text('Llamar')), 1, reason: '"Llamar" va en un renglón');
      _expectTocable(tester, wa, 'el botón de WhatsApp');
      _expectTocable(tester, call, 'el botón de llamar');

      // Tocar un pedido abre su detalle (go_router) y se vuelve.
      final order = find.text('HF-0042');
      await _llevarALaVista(tester, order);
      await tester.tap(order);
      await settle(tester, 8);
      expect(find.text('Venta online o1'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await settle(tester, 8);

      await scrollToEnd(tester, scrollable: _lista());
      await _foto(tester, m, 'cli_ficha_fin');
      expectReachable(
        tester,
        find.textContaining('Este cliente tiene cuenta'),
        what: 'lo último de la ficha',
      );

      // Nota interna con el teclado abierto: el campo y su botón a la vista.
      final note = find.byType(TextField);
      await openKeyboard(tester, note);
      expectFocusedFieldVisible(tester);
      await tester.enterText(note, 'Prefiere retirar por el local los sábados a la mañana.');
      await settle(tester, 3);
      expectFocusedFieldVisible(tester);
      final save = find.widgetWithText(GoldButton, 'Guardar nota');
      expectReachable(tester, save, what: '"Guardar nota" con el teclado abierto');
      await _foto(tester, m, 'cli_ficha_nota');
      // Al escribir, la lista se acomoda sola un instante (lleva el cursor a la
      // vista) y mientras se mueve Flutter ignora los toques. Una persona nunca
      // toca tan rápido: se espera a que quede quieta, como en el teléfono.
      await _esperarQuieta(tester, _lista());
      await tester.tap(save);
      await settle(tester, 5);
      final put = api.calls.where((c) => c.method == 'PUT').single;
      expect(put.path, '/admin/clientes/$idJuan/nota');
      expect(put.body, {
        'source': 'registered',
        'note': 'Prefiere retirar por el local los sábados a la mañana.',
      });
      expect(find.text('Nota guardada'), findsOneWidget);
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        2,
        reason: 'la ficha se vuelve a pedir después de guardar la nota',
      );
      await closeKeyboard(tester);
    });

    _enCadaTelefono('ficha con datos extremos, cliente manual sin datos y error', (tester, m) async {
      await _abrir(
        tester,
        m,
        const SizedBox.shrink(),
        overrides: _api(_fake(get: {'/admin/clientes/$_idExtremo': _fichaExtrema})),
        router: _rutaFicha(_idExtremo),
      );
      await _foto(tester, m, 'cli_ficha_extrema');
      expect(_renglones(tester, find.text('WhatsApp')), 1, reason: '"WhatsApp" va en un renglón');
      await scrollToEnd(tester, scrollable: _lista());
      await _foto(tester, m, 'cli_ficha_extrema_fin');
      expectReachable(
        tester,
        find.textContaining('Este cliente tiene cuenta'),
        what: 'lo último de la ficha',
      );

      await _abrir(
        tester,
        m,
        const SizedBox.shrink(),
        overrides: _api(_fake(get: {'/admin/clientes/$idFeria': _fichaManualVacia})),
        router: _rutaFicha(idFeria),
      );
      await _foto(tester, m, 'cli_ficha_manual');
      expect(find.text('WhatsApp'), findsNothing, reason: 'sin teléfono no hay botones de contacto');
      expectReachable(tester, find.byTooltip('Editar cliente'), what: 'el botón de editar');
      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(
        tester,
        find.widgetWithText(GoldButton, 'Guardar nota'),
        what: 'lo último de la ficha (guardar nota)',
      );
      await _foto(tester, m, 'cli_ficha_manual_fin');

      await _abrir(
        tester,
        m,
        const SizedBox.shrink(),
        overrides: _api(_caido()),
        router: _rutaFicha(idFeria),
      );
      expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón de reintentar');
      await _foto(tester, m, 'cli_ficha_error');
    });

    _enCadaTelefono('alta desde la lista: teclado, avisos a la vista, descartar y guardar', (tester, m) async {
      var falla = true;
      final api = _fake(
        get: {'/admin/clientes': sampleCustomersJson},
        onSend: (method, path, body) {
          if (falla) throw ApiException('unavailable', _errorServidor, status: 503);
          return {'id': idFeria};
        },
      );
      await _abrir(tester, m, const AdminClientesScreen(), overrides: _api(api));
      await tester.tap(find.byType(FloatingActionButton));
      await settle(tester, 8);
      expect(_enBarra('Nuevo cliente'), findsOneWidget);
      await _foto(tester, m, 'cli_alta');
      final save = find.widgetWithText(GoldButton, 'Crear cliente');
      expectReachable(tester, save, what: 'el botón de guardar');

      // Último campo (la nota): teclado, campo a la vista y guardar alcanzable.
      final note = find.widgetWithText(TextField, 'Nota (opcional)');
      await _llevarALaVista(tester, note);
      await openKeyboard(tester, note);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el último campo');
      await tester.enterText(note, 'Llegó por la feria de diciembre.');
      await settle(tester, 3);
      await _foto(tester, m, 'cli_alta_teclado_nota');

      // Falta el nombre: el aviso se ve sin tener que subir a buscar el campo.
      await tester.tap(save);
      await settle(tester, 3);
      expectReachable(
        tester,
        _enGuardar('Ingresá el nombre del cliente.'),
        what: 'el aviso de validación arriba del botón',
      );
      expect(api.calls.where((c) => c.method == 'POST'), isEmpty);
      await _foto(tester, m, 'cli_alta_validacion');

      // Primer campo (el nombre).
      final name = find.widgetWithText(TextField, 'Nombre y apellido');
      await _llevarALaVista(tester, name);
      await openKeyboard(tester, name);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el primer campo');
      await tester.enterText(name, _nombreLargo);
      await settle(tester, 3);
      await _foto(tester, m, 'cli_alta_teclado_nombre');

      // El servidor falla: el error queda a la vista arriba del botón.
      await tester.tap(save);
      await settle(tester, 4);
      expectReachable(tester, _enGuardar(_errorServidor), what: 'el error del servidor');
      await _foto(tester, m, 'cli_alta_error');
      await closeKeyboard(tester);

      // Volver con cambios sin guardar: pregunta antes de descartar.
      await tester.tap(find.byType(BackButton));
      await settle(tester, 6);
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
      _expectConfirmacion(tester, 'Descartar');
      await _foto(tester, m, 'cli_alta_descartar');
      await tester.tap(_boton<TextButton>('Cancelar'));
      await settle(tester, 5);

      // Guardar: vuelve a la lista y la refresca.
      falla = false;
      await tester.tap(save);
      await settle(tester, 10);
      expect(_enBarra('Clientes'), findsOneWidget);
      expect(find.text('Cliente creado'), findsOneWidget);
      final post = api.calls.where((c) => c.method == 'POST').last;
      expect(post.path, '/admin/clientes');
      expect(post.body, {
        'name': _nombreLargo,
        'email': '',
        'phone': '',
        'city': '',
        'note': 'Llegó por la feria de diciembre.',
      });
      expect(
        api.calls.where((c) => c.method == 'GET' && c.path == '/admin/clientes').length,
        2,
        reason: 'la lista se refresca después del alta',
      );
    });

    for (final t in _temas) {
      testWidgets('tema ${t.theme.label}: lista, hoja de niveles y ficha · ${t.phone.name}', (tester) async {
        final m = (phone: t.phone, letra: 1.0, tag: t.tag);
        final api = _fake(get: {
          '/admin/clientes': sampleCustomersJson,
          '/admin/clientes/$idJuan': sampleCustomerDetailJson,
        });
        await _abrir(tester, m, const AdminClientesScreen(), overrides: _api(api), theme: t.theme);
        await _foto(tester, m, 'cli_lista');
        await tester.tap(find.byTooltip('Cómo se calculan los niveles'));
        await settle(tester, 6);
        expectNoLayoutErrors(tester, 'al abrir la hoja de niveles');
        expectReachable(tester, find.text('Clientes recién llegados'), what: 'el último nivel de la hoja');
        await _foto(tester, m, 'cli_niveles');
        await _tocarAfuera(tester);

        await tester.tap(find.text('Juan Pérez'));
        await settle(tester, 8);
        await _foto(tester, m, 'cli_ficha');
        await scrollToEnd(tester, scrollable: _lista());
        expectReachable(
          tester,
          find.textContaining('Este cliente tiene cuenta'),
          what: 'lo último de la ficha',
        );
        await _foto(tester, m, 'cli_ficha_fin');
      });
    }
  });

  // =========================================================================
  group('Descuentos', () {
    _enCadaTelefono('lista larga: final, menú del último cupón, copiar, activar y eliminar', (tester, m) async {
      String? copiado;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'Clipboard.setData') copiado = (call.arguments as Map)['text'] as String?;
        return null;
      });
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null),
      );

      final api = _fake(get: {'/admin/descuentos': _muchosCupones});
      await _abrir(tester, m, const AdminDescuentosScreen(), overrides: _api(api));
      await _foto(tester, m, 'desc_lista');
      expectReachable(tester, _enBarra('Descuentos'), what: 'el título de la pantalla');
      final fab = find.byType(FloatingActionButton);
      expectReachable(tester, fab, what: 'el botón "Crear cupón"');
      expect(_renglones(tester, find.text('Crear cupón')), 1, reason: 'el rótulo del botón va en un renglón');
      _expectTocable(tester, find.byType(ChoiceChip), 'cada filtro de estado');

      await scrollToEnd(tester, scrollable: _lista());
      await _foto(tester, m, 'desc_lista_fin');
      final last = find.widgetWithText(CouponCard, _ultimoCupon);
      expectReachable(tester, last, what: 'el último cupón');
      _expectSinTapar(tester, last, fab, 'el último cupón');

      // Menú emergente del ÚLTIMO cupón: entra entero en la pantalla.
      final menu = find.descendant(of: last, matching: find.byTooltip('Acciones del cupón'));
      await tester.tap(menu);
      await settle(tester, 5);
      expectNoLayoutErrors(tester, 'al abrir el menú del último cupón');
      await _foto(tester, m, 'desc_menu');
      for (final item in const [
        'Editar', 'Activar', 'Copiar código', 'Copiar link directo', 'Compartir por WhatsApp', 'Eliminar',
      ]) {
        expectReachable(tester, find.text(item), what: 'la opción "$item" del menú');
      }

      // Copiar el link directo: mismo formato que la web.
      await tester.tap(find.text('Copiar link directo'));
      await settle(tester, 5);
      expect(copiado, 'https://hefesto3d.com.ar/catalogo?cupon=$_ultimoCupon');
      expectReachable(tester, find.text('Link copiado'), what: 'el aviso de link copiado');
      await _foto(tester, m, 'desc_aviso');
      await _esperarAviso(tester);

      // Activar: PATCH /estado y la lista se vuelve a pedir.
      await tester.tap(menu);
      await settle(tester, 5);
      await tester.tap(find.text('Activar'));
      await settle(tester, 5);
      final patch = api.calls.where((c) => c.method == 'PATCH').single;
      expect(patch.path, '/admin/descuentos/${_uuid(131)}/estado');
      expect(patch.body, {'isActive': true});
      expect(find.text('Cupón activado'), findsOneWidget);
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        2,
        reason: 'la lista se refresca después de activar',
      );
      await _esperarAviso(tester);

      // Eliminar: confirmación con un código larguísimo.
      await tester.tap(menu);
      await settle(tester, 5);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 6);
      expect(find.text('¿Eliminar el cupón $_ultimoCupon?'), findsOneWidget);
      final confirm = _expectConfirmacion(tester, 'Eliminar');
      await _foto(tester, m, 'desc_eliminar');
      await tester.tap(confirm);
      await settle(tester, 6);
      expect(api.calls.where((c) => c.method == 'DELETE').single.path, '/admin/descuentos/${_uuid(131)}');
      expect(find.text('Cupón eliminado'), findsOneWidget);
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        3,
        reason: 'la lista se refresca después de eliminar',
      );
    });

    _enCadaTelefono('lista vacía, error, sin permiso y solo lectura', (tester, m) async {
      await _abrir(
        tester,
        m,
        const AdminDescuentosScreen(),
        overrides: _api(_fake(get: {'/admin/descuentos': () => {'items': <dynamic>[]}})),
      );
      expectReachable(tester, find.text('Todavía no hay cupones'), what: 'el aviso de lista vacía');
      await _foto(tester, m, 'desc_vacio');

      await _abrir(tester, m, const AdminDescuentosScreen(), overrides: _api(_caido()));
      expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón de reintentar');
      await _foto(tester, m, 'desc_error');

      await _abrir(
        tester,
        m,
        const AdminDescuentosScreen(),
        me: staffWith(['descuentos'], actions: const []),
        overrides: _api(_caido()),
      );
      expectReachable(tester, find.text('Sin acceso'), what: 'el aviso de sin acceso');

      // Solo "ver": sin alta, y el menú ofrece nada más que compartir.
      await _abrir(
        tester,
        m,
        const AdminDescuentosScreen(),
        me: staffWith(['descuentos'], actions: const ['ver']),
        overrides: _api(_fake(get: {'/admin/descuentos': sampleCouponsJson})),
      );
      expect(find.byType(FloatingActionButton), findsNothing);
      await tester.tap(find.byTooltip('Acciones del cupón').first);
      await settle(tester, 5);
      expectReachable(tester, find.text('Copiar código'), what: 'la opción de copiar el código');
      expect(find.text('Editar'), findsNothing);
      expect(find.text('Pausar'), findsNothing);
      expect(find.text('Eliminar'), findsNothing);
      await _foto(tester, m, 'desc_solo_ver');
    });

    _enCadaTelefono('alta de cupón: teclado, selector con 40 productos, calendario, avisos y guardar',
        (tester, m) async {
      var falla = true;
      final api = _fake(
        get: {'/admin/descuentos': sampleCouponsJson, '/admin/descuentos/opciones': _muchasOpciones},
        onSend: (method, path, body) {
          if (falla) throw ApiException('invalid', 'El producto o categoría elegido no existe.', status: 422);
          return {'id': _uuid(999)};
        },
      );
      await _abrir(tester, m, const AdminDescuentosScreen(), overrides: _api(api));
      await tester.tap(find.byType(FloatingActionButton));
      await settle(tester, 8);
      expect(_enBarra('Crear cupón'), findsOneWidget);
      await _foto(tester, m, 'cup_alta');
      final save = find.widgetWithText(GoldButton, 'Crear cupón');
      expectReachable(tester, save, what: 'el botón de guardar');

      // Primer campo: el código.
      final code = find.widgetWithText(TextField, 'Código del cupón');
      await _llevarALaVista(tester, code);
      await openKeyboard(tester, code);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el primer campo');
      await tester.enterText(code, 'verano2027');
      await settle(tester, 3);
      await _foto(tester, m, 'cup_alta_teclado_codigo');

      // Último campo de texto: usos máximos.
      final maxUses = find.widgetWithText(TextField, 'Usos máximos');
      await _llevarALaVista(tester, maxUses);
      await openKeyboard(tester, maxUses);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el último campo');
      await tester.enterText(maxUses, '100000');
      await settle(tester, 3);
      await _foto(tester, m, 'cup_alta_teclado_usos');

      // Falta el valor (el campo quedó arriba, fuera de la vista): el aviso se
      // ve igual, fijo arriba del botón.
      await tester.tap(save);
      await settle(tester, 3);
      expectReachable(
        tester,
        _enGuardar('Ingresá un valor mayor a 0.'),
        what: 'el aviso de validación arriba del botón',
      );
      expect(api.calls.where((c) => c.method == 'POST'), isEmpty);
      await _foto(tester, m, 'cup_alta_validacion');
      await closeKeyboard(tester);
      final value = find.widgetWithText(TextField, 'Valor (%)');
      await _llevarALaVista(tester, value);
      await tester.enterText(value, '12,5');
      await settle(tester, 3);

      // "Aplica a → Un producto": selector con 40 productos de nombre largo.
      final scope = find.widgetWithText(ChoiceChip, 'Un producto');
      await _llevarALaVista(tester, scope);
      await tester.tap(scope);
      await settle(tester, 4);
      final pick = find.widgetWithText(PickerField, 'Producto');
      await _llevarALaVista(tester, pick);
      await tester.tap(pick);
      await settle(tester, 8);
      await _probarSelector(
        tester,
        m,
        'cup_selector',
        titulo: 'Elegí el producto',
        ultima: _producto(39),
        buscar: 'modelo 38',
        elegir: _producto(38),
      );
      expect(
        find.descendant(of: pick, matching: find.text(_producto(38))),
        findsOneWidget,
        reason: 'el campo muestra el producto elegido',
      );

      // Vencimiento: el selector de día de la app.
      final expiry = find.widgetWithText(PickerField, 'Vence el');
      await _llevarALaVista(tester, expiry);
      await tester.tap(expiry);
      await settle(tester, 6);
      expectNoLayoutErrors(tester, 'al abrir el calendario');
      final dialog = find.byType(Dialog);
      final accept = find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Aceptar'));
      expectReachable(tester, accept, what: 'el botón "Aceptar" del calendario');
      expectReachable(
        tester,
        find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')),
        what: 'el botón "Cancelar" del calendario',
      );
      await _foto(tester, m, 'cup_calendario');
      await tester.tap(find.descendant(of: dialog, matching: find.text('15')));
      await tester.pump();
      await tester.tap(accept);
      await settle(tester, 6);
      expect(
        find.descendant(of: expiry, matching: find.textContaining('15 ')),
        findsOneWidget,
        reason: 'el campo muestra el día elegido',
      );
      expectReachable(tester, find.byTooltip('Quitar'), what: 'la cruz para quitar el vencimiento');

      // El servidor rechaza: el error queda a la vista arriba del botón.
      await tester.tap(save);
      await settle(tester, 4);
      expectReachable(
        tester,
        _enGuardar('El producto o categoría elegido no existe.'),
        what: 'el error del servidor',
      );
      await _foto(tester, m, 'cup_alta_error');

      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(tester, find.text('Cupón activo'), what: 'lo último del formulario');
      await _foto(tester, m, 'cup_alta_fin');

      // Volver con cambios sin guardar: pregunta antes de descartar.
      await tester.tap(find.byType(BackButton));
      await settle(tester, 6);
      expect(find.text('¿Descartar los cambios?'), findsOneWidget);
      _expectConfirmacion(tester, 'Descartar');
      await _foto(tester, m, 'cup_descartar');
      await tester.tap(_boton<TextButton>('Cancelar'));
      await settle(tester, 5);

      // Guardar: vuelve a la lista y la refresca.
      falla = false;
      await tester.tap(save);
      await settle(tester, 10);
      expect(_enBarra('Descuentos'), findsOneWidget);
      expect(find.text('Cupón creado'), findsOneWidget);
      final post = api.calls.where((c) => c.method == 'POST').last;
      expect(post.path, '/admin/descuentos');
      final body = post.body! as Map<String, dynamic>;
      expect(body['code'], 'VERANO2027');
      expect(body['type'], 'percentage');
      expect(body['value'], 12.5);
      expect(body['minPurchase'], 0);
      expect(body['maxUses'], 100000);
      expect(body['scope'], 'product');
      expect(body['targetId'], _uuid(538));
      expect(body['targetLabel'], _producto(38));
      expect(body['expiresAt'], matches(RegExp(r'^\d{4}-\d{2}-15$')));
      expect(body['isActive'], isTrue);
      expect(
        api.calls.where((c) => c.method == 'GET' && c.path == '/admin/descuentos').length,
        2,
        reason: 'la lista se refresca después del alta',
      );
    });

    _enCadaTelefono('edición de un cupón con datos extremos', (tester, m) async {
      final api = _fake(get: {
        '/admin/descuentos': _muchosCupones,
        '/admin/descuentos/opciones': _muchasOpciones,
      });
      await _abrir(tester, m, const AdminDescuentosScreen(), overrides: _api(api));
      final card = find.text(_cuponExtremo);
      await _llevarALaVista(tester, card);
      await tester.tap(card);
      await settle(tester, 8);
      expect(_enBarra('Editar cupón'), findsOneWidget);
      await _foto(tester, m, 'cup_edicion');
      expectReachable(tester, find.widgetWithText(GoldButton, 'Guardar cambios'), what: 'el botón de guardar');
      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(tester, find.text('Cupón activo'), what: 'lo último del formulario');
      await _foto(tester, m, 'cup_edicion_fin');
    });

    for (final t in _temas) {
      testWidgets('tema ${t.theme.label}: lista, menú, confirmación, formulario y selector · ${t.phone.name}',
          (tester) async {
        final m = (phone: t.phone, letra: 1.0, tag: t.tag);
        final api = _fake(get: {
          '/admin/descuentos': sampleCouponsJson,
          '/admin/descuentos/opciones': _muchasOpciones,
        });
        await _abrir(tester, m, const AdminDescuentosScreen(), overrides: _api(api), theme: t.theme);
        await _foto(tester, m, 'desc_lista');
        await tester.tap(find.byTooltip('Acciones del cupón').first);
        await settle(tester, 5);
        expectReachable(tester, find.text('Eliminar'), what: 'la opción "Eliminar" del menú');
        await _foto(tester, m, 'desc_menu');
        await tester.tap(find.text('Eliminar'));
        await settle(tester, 6);
        _expectConfirmacion(tester, 'Eliminar');
        await _foto(tester, m, 'desc_eliminar');
        await tester.tap(_boton<TextButton>('Cancelar'));
        await settle(tester, 5);

        await tester.tap(find.byType(FloatingActionButton));
        await settle(tester, 8);
        await _foto(tester, m, 'cup_alta');
        final scope = find.widgetWithText(ChoiceChip, 'Una categoría');
        await _llevarALaVista(tester, scope);
        await tester.tap(scope);
        await settle(tester, 4);
        final pick = find.widgetWithText(PickerField, 'Categoría');
        await _llevarALaVista(tester, pick);
        await tester.tap(pick);
        await settle(tester, 8);
        expectNoLayoutErrors(tester, 'al abrir el selector de categoría');
        final close = find.byTooltip('Cerrar');
        expectReachable(tester, close, what: 'la cruz de cerrar el selector');
        await _foto(tester, m, 'cup_selector');
        await tester.tap(close);
        await settle(tester, 6);
        expect(find.byType(BottomSheet), findsNothing);
      });
    }
  });

  // =========================================================================
  group('Recompensas', () {
    _enCadaTelefono('pantalla larga: menú de la última recompensa, pausar, eliminar y final', (tester, m) async {
      final api = _fake(get: {'/admin/recompensas': _muchasRecompensas});
      await _abrir(tester, m, const AdminRecompensasScreen(), overrides: _api(api));
      await _foto(tester, m, 'rec_pantalla');
      expectReachable(tester, _enBarra('Recompensas'), what: 'el título de la pantalla');
      final fab = find.byType(FloatingActionButton);
      expectReachable(tester, fab, what: 'el botón "Nueva recompensa"');
      expect(_renglones(tester, find.text('Nueva recompensa')), 1, reason: 'el rótulo del botón va en un renglón');

      // La última recompensa del catálogo, al pie de la pantalla (justo arriba
      // del botón flotante): su menú entra entero.
      final card = find.widgetWithText(RewardCard, _ultimaRecompensa);
      await _llevarALaVista(tester, card, alignment: 1);
      final pos = tester.state<ScrollableState>(_lista()).position;
      pos.jumpTo(math.min(pos.pixels + 96, pos.maxScrollExtent));
      await settle(tester, 3);
      await _foto(tester, m, 'rec_ultima');
      final menu = find.descendant(of: card, matching: find.byTooltip('Acciones de la recompensa'));
      expectReachable(tester, menu, what: 'el botón de acciones de la última recompensa');
      await tester.tap(menu);
      await settle(tester, 5);
      expectNoLayoutErrors(tester, 'al abrir el menú de la última recompensa');
      for (final item in const ['Editar', 'Pausar', 'Eliminar']) {
        expectReachable(tester, find.text(item), what: 'la opción "$item" del menú');
      }
      await _foto(tester, m, 'rec_menu');

      // Pausar: PUT con la recompensa completa y la pantalla se vuelve a pedir.
      await tester.tap(find.text('Pausar'));
      await settle(tester, 5);
      final put = api.calls.where((c) => c.method == 'PUT').single;
      expect(put.path, '/admin/recompensas/${_uuid(231)}');
      expect(put.body, {
        'type': 'discount',
        'title': _ultimaRecompensa,
        'description': '',
        'costPoints': 3200,
        'discountValue': 12.5,
        'discountIsPercent': true,
        'productId': null,
        'isActive': false,
      });
      expect(find.text('Recompensa pausada'), findsOneWidget);
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        2,
        reason: 'la pantalla se refresca después de pausar',
      );
      await _esperarAviso(tester);

      // Eliminar: confirmación con un título larguísimo.
      await tester.tap(menu);
      await settle(tester, 5);
      await tester.tap(find.text('Eliminar'));
      await settle(tester, 6);
      expect(find.text('¿Eliminar "$_ultimaRecompensa"?'), findsOneWidget);
      final confirm = _expectConfirmacion(tester, 'Eliminar');
      await _foto(tester, m, 'rec_eliminar');
      await tester.tap(confirm);
      await settle(tester, 6);
      expect(api.calls.where((c) => c.method == 'DELETE').single.path, '/admin/recompensas/${_uuid(231)}');
      expect(find.text('Recompensa eliminada'), findsOneWidget);
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        3,
        reason: 'la pantalla se refresca después de eliminar',
      );
      await _esperarAviso(tester);

      // Final de la pantalla: el último canje, arriba del botón flotante.
      await scrollToEnd(tester, scrollable: _lista());
      await _foto(tester, m, 'rec_pantalla_fin');
      final lastRow = find.text(_ultimoCanje);
      expectReachable(tester, lastRow, what: 'el último canje');
      _expectSinTapar(tester, lastRow, fab, 'el último canje');
    });

    _enCadaTelefono('catálogo vacío, error, sin permiso y solo lectura', (tester, m) async {
      await _abrir(
        tester,
        m,
        const AdminRecompensasScreen(),
        overrides: _api(_fake(get: {'/admin/recompensas': () => {'rewards': <dynamic>[]}})),
      );
      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(tester, find.text('Todavía nadie canjeó puntos.'), what: 'lo último de la pantalla');
      expect(find.text('Todavía no creaste recompensas.'), findsOneWidget);
      await _foto(tester, m, 'rec_vacio');

      await _abrir(tester, m, const AdminRecompensasScreen(), overrides: _api(_caido()));
      expectReachable(tester, find.widgetWithText(GoldButton, 'Reintentar'), what: 'el botón de reintentar');
      await _foto(tester, m, 'rec_error');

      await _abrir(
        tester,
        m,
        const AdminRecompensasScreen(),
        me: staffWith(['recompensas'], actions: const []),
        overrides: _api(_caido()),
      );
      expectReachable(tester, find.text('Sin acceso'), what: 'el aviso de sin acceso');

      await _abrir(
        tester,
        m,
        const AdminRecompensasScreen(),
        me: staffWith(['recompensas'], actions: const ['ver']),
        overrides: _api(_fake(get: {'/admin/recompensas': sampleRewardsJson})),
      );
      expect(find.byType(FloatingActionButton), findsNothing);
      expect(find.byTooltip('Acciones de la recompensa'), findsNothing);
      await _foto(tester, m, 'rec_solo_ver');
    });

    _enCadaTelefono('alta de recompensa: teclado, selector con 40 productos, avisos y guardar', (tester, m) async {
      var falla = true;
      final api = _fake(
        get: {'/admin/recompensas': _muchasRecompensas},
        onSend: (method, path, body) {
          if (falla) throw ApiException('unavailable', _errorServidor, status: 503);
          return {'id': _uuid(998)};
        },
      );
      await _abrir(tester, m, const AdminRecompensasScreen(), overrides: _api(api));
      await tester.tap(find.byType(FloatingActionButton));
      await settle(tester, 8);
      expect(_enBarra('Nueva recompensa'), findsOneWidget);
      await _foto(tester, m, 'rec_alta');
      final save = find.widgetWithText(GoldButton, 'Crear recompensa');
      expectReachable(tester, save, what: 'el botón de guardar');

      // Primer campo: el título.
      final title = find.widgetWithText(TextField, 'Título');
      await _llevarALaVista(tester, title);
      await openKeyboard(tester, title);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el primer campo');
      await tester.enterText(title, _tituloLargo);
      await settle(tester, 3);
      await _foto(tester, m, 'rec_alta_teclado_titulo');

      // Último campo: el monto del descuento.
      final amount = find.widgetWithText(TextField, 'Monto');
      await _llevarALaVista(tester, amount);
      await openKeyboard(tester, amount);
      expectFocusedFieldVisible(tester);
      expectReachable(tester, save, what: 'guardar con el teclado abierto en el último campo');
      await tester.enterText(amount, '987.654.321');
      await settle(tester, 3);
      await _foto(tester, m, 'rec_alta_teclado_monto');

      // Falta el costo (el campo quedó arriba): el aviso se ve igual.
      await tester.tap(save);
      await settle(tester, 3);
      expectReachable(
        tester,
        _enGuardar('Ingresá el costo en puntos.'),
        what: 'el aviso de validación arriba del botón',
      );
      expect(api.calls.where((c) => c.method == 'POST'), isEmpty);
      await _foto(tester, m, 'rec_alta_validacion');
      await closeKeyboard(tester);
      final cost = find.widgetWithText(TextField, 'Costo en puntos');
      await _llevarALaVista(tester, cost);
      await tester.enterText(cost, '123456789');
      await settle(tester, 3);

      // "Producto gratis": selector con 40 productos de nombre largo.
      final type = find.widgetWithText(ChoiceChip, 'Producto gratis');
      await _llevarALaVista(tester, type);
      await tester.tap(type);
      await settle(tester, 4);
      final pick = find.widgetWithText(PickerField, 'Producto');
      await _llevarALaVista(tester, pick);
      await tester.tap(pick);
      await settle(tester, 8);
      await _probarSelector(
        tester,
        m,
        'rec_selector',
        titulo: 'Producto de regalo',
        ultima: _producto(39),
        buscar: 'modelo 38',
        elegir: _producto(38),
      );

      // El servidor falla: el error queda a la vista arriba del botón.
      await tester.tap(save);
      await settle(tester, 4);
      expectReachable(tester, _enGuardar(_errorServidor), what: 'el error del servidor');
      await _foto(tester, m, 'rec_alta_error');

      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(tester, find.text('Recompensa activa'), what: 'lo último del formulario');
      await _foto(tester, m, 'rec_alta_fin');

      // Guardar: vuelve a la pantalla y la refresca.
      falla = false;
      await tester.tap(save);
      await settle(tester, 10);
      expect(_enBarra('Recompensas'), findsOneWidget);
      expect(find.text('Recompensa creada'), findsOneWidget);
      final post = api.calls.where((c) => c.method == 'POST').last;
      expect(post.path, '/admin/recompensas');
      expect(post.body, {
        'type': 'product',
        'title': _tituloLargo,
        'description': '',
        'costPoints': 123456789,
        'discountValue': null,
        'discountIsPercent': false,
        'productId': _uuid(538),
        'isActive': true,
      });
      expect(
        api.calls.where((c) => c.method == 'GET').length,
        2,
        reason: 'la pantalla se refresca después del alta',
      );
    });

    _enCadaTelefono('edición de una recompensa con datos extremos', (tester, m) async {
      final api = _fake(get: {'/admin/recompensas': _muchasRecompensas});
      await _abrir(tester, m, const AdminRecompensasScreen(), overrides: _api(api));
      final first = find.text(_primeraRecompensa);
      await _llevarALaVista(tester, first);
      await tester.tap(first);
      await settle(tester, 8);
      expect(_enBarra('Editar recompensa'), findsOneWidget);
      await _foto(tester, m, 'rec_edicion');
      expectReachable(tester, find.widgetWithText(GoldButton, 'Guardar cambios'), what: 'el botón de guardar');
      await scrollToEnd(tester, scrollable: _lista());
      expectReachable(tester, find.text('Recompensa activa'), what: 'lo último del formulario');
      await _foto(tester, m, 'rec_edicion_fin');
    });

    for (final t in _temas) {
      testWidgets('tema ${t.theme.label}: pantalla, menú, confirmación y formulario · ${t.phone.name}',
          (tester) async {
        final m = (phone: t.phone, letra: 1.0, tag: t.tag);
        final api = _fake(get: {'/admin/recompensas': sampleRewardsJson});
        await _abrir(tester, m, const AdminRecompensasScreen(), overrides: _api(api), theme: t.theme);
        await _foto(tester, m, 'rec_pantalla');
        final menu = find.byTooltip('Acciones de la recompensa').first;
        await _llevarALaVista(tester, menu);
        await tester.tap(menu);
        await settle(tester, 5);
        expectReachable(tester, find.text('Eliminar'), what: 'la opción "Eliminar" del menú');
        await _foto(tester, m, 'rec_menu');
        await tester.tap(find.text('Eliminar'));
        await settle(tester, 6);
        _expectConfirmacion(tester, 'Eliminar');
        await _foto(tester, m, 'rec_eliminar');
        await tester.tap(_boton<TextButton>('Cancelar'));
        await settle(tester, 5);
        await scrollToEnd(tester, scrollable: _lista());
        await _foto(tester, m, 'rec_pantalla_fin');

        await tester.tap(find.byType(FloatingActionButton));
        await settle(tester, 8);
        await _foto(tester, m, 'rec_alta');
        await scrollToEnd(tester, scrollable: _lista());
        expectReachable(tester, find.text('Recompensa activa'), what: 'lo último del formulario');
        await _foto(tester, m, 'rec_alta_fin');
      });
    }
  });
}
