import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart' show ApiException;
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/features/admin/auditoria/audit_detail_screen.dart';
import 'package:hefesto/features/admin/auditoria/audit_models.dart';
import 'package:hefesto/features/admin/auditoria/audit_providers.dart';
import 'package:hefesto/features/admin/auditoria/auditoria_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Dibuja las pantallas de Auditoría con datos de ejemplo (humo + capturas con
/// SHOT_DIR=ruta_de_una_carpeta, igual que admin_screens_test.dart).
final _shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

MeInfo _me({bool audit = true}) => MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': 'admin',
      'isStaff': true,
      'permissions': {
        'auditoria': {'ver': audit, 'crear': false, 'editar': false, 'eliminar': false},
      },
    });

Map<String, dynamic> _e(
  String id,
  String action,
  DateTime at, {
  String? entity,
  Object? meta,
  Map<String, dynamic>? actor = const {'id': 'u1', 'name': 'Ale', 'role': 'admin'},
}) =>
    {
      'id': id,
      'action': action,
      'actionLabel': null,
      'entityType': entity,
      'entityId': entity == null ? null : 'ent-$id',
      'metadata': meta,
      'createdAt': at.toUtc().toIso8601String(),
      'actor': actor,
    };

final _now = DateTime.now();
DateTime _ago(int days, int hour, [int minute = 0]) =>
    DateTime(_now.year, _now.month, _now.day, hour, minute).subtract(Duration(days: days));

AuditPage _page({bool hasMore = false, int n = 1}) => AuditPage.fromJson({
      'items': [
        _e('1', 'order.status_changed', _ago(0, 0, 5), entity: 'order', meta: {
          'orderNumber': 'HF-0042',
          'status': 'in_production',
        }),
        _e('2', 'manual_sale.created', _ago(0, 0, 1), entity: 'manual_sale', meta: {'total': 15000, 'customer': 'Feria'}),
        _e('3', 'product.deleted', _ago(1, 18, 30), entity: 'product', meta: {'name': 'Mate Mario con un nombre larguísimo para probar el recorte del texto'}),
        _e('4', 'inventory.order_deduct_failed', _ago(1, 9), entity: 'order', actor: null, meta: {'orderNumber': 'HF-0040'}),
        _e('5', 'team.member_invited', _ago(3, 11), entity: 'team', meta: {'roleId': '9f1c2d3e-0000-4000-8000-000000000001'}),
        _e('6', 'algo.nuevo_sin_traducir', _ago(6, 8), actor: {'id': 'u9', 'name': null, 'role': 'operator'}),
      ],
      'page': n,
      'pageSize': 30,
      'hasMore': hasMore,
      if (n == 1)
        'facets': {
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
        },
    });

class _FakeAuditApi implements AuditApi {
  _FakeAuditApi({this.pages, this.fail = false});
  final List<AuditPage>? pages;
  bool fail;
  final calls = <(AuditFilters, int, bool)>[];

  @override
  Future<AuditPage> fetch(AuditFilters filters, {int page = 1, bool facets = false}) async {
    calls.add((filters, page, facets));
    if (fail) throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión.');
    final list = pages ?? [_page()];
    return list[(page - 1).clamp(0, list.length - 1)];
  }

  @override
  Future<AuditEntry> detail(String id) async {
    final all = (pages ?? [_page()]).expand((p) => p.items);
    return all.firstWhere((e) => e.id == id);
  }
}

Future<void> _show(
  WidgetTester tester,
  String name,
  Widget screen, {
  double height = 880,
  double width = 392,
  MeInfo? me,
  List<Override> overrides = const [],
  double textScale = 1,
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me ?? _me()),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(HefestoThemeMode.dark),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: screen,
        ),
      ),
    ),
  );
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');

  if (_shotDir != null) {
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('$_shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    // Tipografías de la marca e íconos de Material: con las de verdad, los
    // anchos son los reales (con la fuente de prueba, que es cuadrada, un
    // texto grande se "desborda" aunque en el celular entre de sobra).
    if (_shotDir != null) Directory(_shotDir!).createSync(recursive: true);
    await _loadFont('Orbitron', ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf']);
    await _loadFont('Sora', [
      'assets/fonts/Sora-Regular.ttf',
      'assets/fonts/Sora-Medium.ttf',
      'assets/fonts/Sora-SemiBold.ttf',
      'assets/fonts/Sora-Bold.ttf',
    ]);
    final root = Platform.environment['FLUTTER_ROOT'];
    if (root != null) {
      await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
    }
  });

  testWidgets('Lista: días, acciones traducidas, quién y qué', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_lista', const AdminAuditoriaScreen(),
        height: 1250, overrides: [auditApiProvider.overrideWithValue(api)]);

    expect(find.text('HOY'), findsOneWidget);
    expect(find.text('AYER'), findsOneWidget);
    expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
    expect(find.text('Cargó una venta manual'), findsOneWidget);
    expect(find.text('Borró un producto'), findsOneWidget);
    expect(find.text('Invitó a una persona al equipo'), findsOneWidget);
    // Código que la app no conoce: texto legible, no el código crudo.
    expect(find.text('Algo: nuevo sin traducir'), findsOneWidget);
    expect(find.textContaining('algo.nuevo'), findsNothing);
    // Detalle resumido y traducido.
    expect(find.textContaining('Pedido: HF-0042'), findsWidgets);
    expect(find.textContaining(r'Total: $15.000'), findsOneWidget);
    // Sin autor = Sistema.
    expect(find.text('Sistema'), findsOneWidget);
    // La primera carga pide las opciones de filtro.
    expect(api.calls.first.$3, isTrue);
  });

  testWidgets('Chips por tipo: tocar uno filtra', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_chips', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(api)]);

    expect(find.widgetWithText(ChoiceChip, 'Todo'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Pedido'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Venta manual'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Pedido'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(api.calls.last.$1.entity, 'order');
    expect(api.calls.last.$2, 1, reason: 'un filtro nuevo vuelve a la primera página');
    expect(api.calls.last.$3, isFalse, reason: 'las opciones no se vuelven a pedir');
  });

  testWidgets('Hoja de filtros: persona, acción y período', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_filtros', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(api)]);

    await tester.tap(find.byTooltip('Filtros'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Filtros'), findsWidgets);
    expect(find.text('Últimos 7 días'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Ale'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Sistema'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Cambió el estado de un pedido'), findsOneWidget);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Ale'));
    await tester.tap(find.widgetWithText(ChoiceChip, 'Últimos 7 días'));
    await tester.pump();
    await tester.tap(find.text('Aplicar'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    final f = api.calls.last.$1;
    expect(f.actor, 'u1');
    expect(f.period, AuditPeriod.week);
    // Quedan visibles como chips con "x".
    expect(find.widgetWithText(InputChip, 'Ale'), findsOneWidget);
    expect(find.widgetWithText(InputChip, 'Últimos 7 días'), findsOneWidget);
  });

  testWidgets('Buscar escribe y consulta con el texto (con demora)', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_busqueda', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(api)]);
    final before = api.calls.length;

    await tester.enterText(find.byType(TextField), 'mate');
    await tester.pump(const Duration(milliseconds: 100));
    expect(api.calls.length, before, reason: 'todavía no: espera a que termine de escribir');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 100));
    expect(api.calls.last.$1.q, 'mate');
  });

  testWidgets('Tocar un evento abre el detalle con todo traducido', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_lista2', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(api)]);

    await tester.tap(find.text('Cargó una venta manual'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 400));

    expect(find.text('Detalle del evento'), findsOneWidget);
    expect(find.text('Venta manual'), findsWidgets);
    expect(find.text(r'$15.000'), findsOneWidget);
    expect(find.text('Cliente'), findsOneWidget);
    expect(find.text('Feria'), findsOneWidget);
    expect(find.text('manual_sale.created'), findsOneWidget, reason: 'el código queda en datos técnicos');
    expect(tester.takeException(), isNull);
  });

  testWidgets('Detalle de un evento del sistema, sin datos y de una acción desconocida', (tester) async {
    final sysEntry = AuditEntry.fromJson(_e('9', 'inventory.order_deduct_failed', _ago(0, 3), entity: 'order', actor: null));
    await _show(
      tester,
      'auditoria_detalle_sistema',
      AuditDetailScreen(entry: sysEntry),
      overrides: [auditApiProvider.overrideWithValue(_FakeAuditApi(pages: [_page()]))],
    );
    expect(find.text('Falló el descuento de stock de un pedido'), findsOneWidget);
    expect(find.text('Sistema'), findsOneWidget);
    expect(find.text('Este evento no guardó más datos.'), findsOneWidget);
  });

  testWidgets('Detalle con el servidor caído conserva lo que trajo la lista', (tester) async {
    final entry = _page().items.first;
    await _show(
      tester,
      'auditoria_detalle',
      AuditDetailScreen(entry: entry),
      height: 1100,
      overrides: [auditApiProvider.overrideWithValue(_FakeAuditApi(fail: true))],
    );
    expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
    expect(find.text('HF-0042'), findsOneWidget);
    expect(find.text('En producción'), findsOneWidget);
    expect(find.text('Administrador'), findsOneWidget);
  });

  testWidgets('Cargar más: pide la página 2 al llegar abajo y no repite eventos', (tester) async {
    final p1 = _page(hasMore: true);
    final p2 = AuditPage.fromJson({
      'items': [
        _e('1', 'order.status_changed', _ago(0, 0, 5), entity: 'order'), // repetido
        _e('7', 'category.created', _ago(8, 10), entity: 'category', meta: {'name': 'Llaveros'}),
      ],
      'page': 2,
      'hasMore': false,
    });
    final api = _FakeAuditApi(pages: [p1, p2]);
    await _show(tester, 'auditoria_mas', const AdminAuditoriaScreen(),
        height: 560, overrides: [auditApiProvider.overrideWithValue(api)]);

    await tester.drag(find.byType(ListView).last, const Offset(0, -2500));
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    expect(api.calls.any((c) => c.$2 == 2), isTrue);
    expect(find.text('Creó una categoría'), findsOneWidget);
    expect(find.text('Cambió el estado de un pedido'), findsNothing, reason: 'se fue scroll arriba');
  });

  testWidgets('Sin registros', (tester) async {
    await _show(
      tester,
      'auditoria_vacia',
      const AdminAuditoriaScreen(),
      overrides: [auditApiProvider.overrideWithValue(_FakeAuditApi(pages: [AuditPage.fromJson({'items': []})]))],
    );
    expect(find.text('Todavía no hay registros'), findsOneWidget);
  });

  testWidgets('Filtros sin resultados ofrecen limpiar', (tester) async {
    final empty = _FakeAuditApi(pages: [AuditPage.fromJson({'items': []})]);
    await _show(tester, 'auditoria_sin_resultados', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(empty)]);
    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('No hay registros con esos filtros'), findsOneWidget);
    expect(find.text('Limpiar filtros'), findsOneWidget);
  });

  testWidgets('Error del servidor: mensaje y Reintentar que funciona', (tester) async {
    final api = _FakeAuditApi(fail: true);
    await _show(tester, 'auditoria_error', const AdminAuditoriaScreen(),
        overrides: [auditApiProvider.overrideWithValue(api)]);
    expect(find.text('Reintentar'), findsOneWidget);
    expect(find.textContaining('No pudimos conectarnos'), findsOneWidget);

    api.fail = false;
    await tester.tap(find.text('Reintentar'));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Reintentar'), findsNothing);
    expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
  });

  testWidgets('Sin permiso de auditoría se muestra "Sin acceso"', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_sin_acceso', const AdminAuditoriaScreen(),
        me: _me(audit: false), overrides: [auditApiProvider.overrideWithValue(api)]);
    expect(find.text('Sin acceso'), findsOneWidget);
    expect(find.text('Cambió el estado de un pedido'), findsNothing);
  });

  testWidgets('A 360 de ancho y con la letra grande no se desborda', (tester) async {
    final api = _FakeAuditApi();
    await _show(tester, 'auditoria_360_letra_grande', const AdminAuditoriaScreen(),
        width: 360, textScale: 1.5, overrides: [auditApiProvider.overrideWithValue(api)]);
    expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
  });

  testWidgets('Los tres temas se ven bien', (tester) async {
    for (final mode in HefestoThemeMode.values) {
      final api = _FakeAuditApi();
      tester.view.devicePixelRatio = 2.75;
      tester.view.physicalSize = const Size(392 * 2.75, 880 * 2.75);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
            meProvider.overrideWith((ref) async => _me()),
            auditApiProvider.overrideWithValue(api),
          ],
          child: MaterialApp(theme: AppTheme.of(mode), home: const AdminAuditoriaScreen()),
        ),
      );
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(tester.takeException(), isNull, reason: 'tema ${mode.name}');
      expect(find.text('Cambió el estado de un pedido'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    }
    addTearDown(tester.view.reset);
  });
}
