import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton;
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/filamentos/filamento_detail_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamento_form_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_api.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_models.dart';
import 'package:hefesto/features/admin/filamentos/movements_screen.dart';
import 'package:hefesto/features/admin/filamentos/stock_adjust_sheet.dart';
import 'package:hefesto/features/admin/stock_screen.dart';

import 'support/produccion_fallas_filamentos_kit.dart';

/// API de mentira: anota lo que la pantalla manda y no toca la red.
class FakeFilamentosApi extends FilamentosApi {
  FakeFilamentosApi() : super(ApiClient());

  FilamentoDraft? created;
  (String, FilamentoDraft)? updated;
  String? deletedId;
  final adjusts = <({String id, double? delta, double? newStock, String? reason})>[];
  final catalogAdds = <(String kind, String name, String? hex)>[];
  final catalogRemoves = <(String kind, String name)>[];
  Object? failWith;
  StockAdjustResult adjustResult =
      const StockAdjustResult(deltaGrams: 1000, previousStock: 840, newStock: 1840, lowStock: false);

  void _maybeFail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<Filamento> create(FilamentoDraft d) async {
    _maybeFail();
    created = d;
    return Filamento.fromJson({'id': 'nuevo', ...d.toCreateJson(), 'status': 'ok'});
  }

  @override
  Future<Filamento> update(String id, FilamentoDraft d) async {
    _maybeFail();
    updated = (id, d);
    return Filamento.fromJson({'id': id, ...d.toUpdateJson(), 'status': 'ok'});
  }

  @override
  Future<void> delete(String id) async {
    _maybeFail();
    deletedId = id;
  }

  @override
  Future<StockAdjustResult> adjust(String id, {double? deltaGrams, double? newStockGrams, String? reason}) async {
    _maybeFail();
    adjusts.add((id: id, delta: deltaGrams, newStock: newStockGrams, reason: reason));
    return adjustResult;
  }

  @override
  Future<void> addCatalog(String kind, String name, {String? hex}) async {
    _maybeFail();
    catalogAdds.add((kind, name, hex));
  }

  @override
  Future<void> removeCatalog(String kind, String name) async {
    _maybeFail();
    catalogRemoves.add((kind, name));
  }

  @override
  Future<String> report() async => 'INFORME DE FILAMENTOS\n• Total: 2 kg';
}

Map<String, dynamic> filJson(String id, String color, String hex, num stock, String status, {num cost = 20000}) => {
      'id': id,
      'material': 'PLA',
      'color': color,
      'brand': 'Grilon3',
      'diameter': '1.75',
      'stockGrams': stock,
      'spoolGrams': 1000,
      'costPerKg': cost,
      'alertThresholdGrams': 200,
      'lowStock': status != 'ok',
      'status': status,
      'hex': hex,
    };

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(setUpKit);

  final full = meWith({'filamentos': allActions});
  final readOnly = meWith({'filamentos': ['ver']}, role: 'operator');

  final stock = StockPage.fromJson({
    'counts': {'total': 3, 'low': 1, 'out': 1},
    'items': [
      filJson('1', 'Blanco', '#F2F2F2', 840, 'ok'),
      filJson('2', 'Rojo', '#CC2200', 120, 'bajo'),
      filJson('3', 'Negro', '#111111', 0, 'agotado'),
    ],
  });

  final rojo = Filamento.fromJson(filJson('2', 'Rojo', '#CC2200', 120, 'bajo'));
  final debe = Filamento.fromJson(filJson('3', 'Negro', '#111111', -30, 'agotado'));
  final movs = [
    FilamentMovement.fromJson({
      'id': 'm1',
      'filamentId': '2',
      'material': 'PLA',
      'color': 'Rojo',
      'deltaGrams': -80,
      'reason': 'order',
      'reasonLabel': 'Pedido online',
      'ref': 'HF-0042',
      'createdAt': '2026-10-30T15:00:00.000Z',
    }),
    FilamentMovement.fromJson({
      'id': 'm2',
      'filamentId': '2',
      'material': 'PLA',
      'color': 'Rojo',
      'deltaGrams': 1000,
      'reason': 'adjust',
      'reasonLabel': 'Ajuste de stock',
      'ref': null,
      'createdAt': '2026-10-29T09:00:00.000Z',
    }),
    FilamentMovement.fromJson({
      'id': 'm3',
      'filamentId': '3',
      'material': 'PLA',
      'color': 'Negro',
      'deltaGrams': -40,
      'reason': 'failure',
      'reasonLabel': 'Impresión fallida',
      'ref': 'Lámpara lunar',
      'createdAt': '2026-10-28T09:00:00.000Z',
    }),
  ];
  final catalog = FilamentCatalog.fromJson({
    'colors': [
      {'name': 'Rojo', 'hex': '#CC2200'},
      {'name': 'Negro', 'hex': '#111111'},
      {'name': 'Verde militar', 'hex': '#4B5320'},
    ],
    'brands': [
      {'name': 'Grilon3'},
      {'name': 'eSun'},
    ],
    'materials': [
      {'name': 'PLA'},
      {'name': 'PETG'},
    ],
    'diameters': ['1.75', '2.85', '—'],
  });

  group('pestaña Stock', () {
    testWidgets('lista los carretes con sus alertas y el botón Agregar', (tester) async {
      await showScreen(
        tester,
        'stock_gestion',
        const AdminStockScreen(),
        height: 1100,
        me: full,
        overrides: [adminStockProvider.overrideWith((ref) async => stock)],
      );
      expect(find.text('Agotado'), findsOneWidget);
      expect(find.text('Stock bajo'), findsWidgets);
      expect(find.text('Agregar'), findsOneWidget);
      expect(find.byTooltip('Historial de movimientos'), findsOneWidget);
      expect(find.textContaining('de filamento en stock'), findsOneWidget);
      // Ya no manda al panel web para cargar stock.
      expect(find.textContaining('panel web'), findsNothing);
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'stock_fuente_grande',
        const AdminStockScreen(),
        width: 360,
        height: 1500,
        textScale: 1.4,
        me: full,
        overrides: [adminStockProvider.overrideWith((ref) async => stock)],
      );
      expect(find.text('Agotado'), findsOneWidget);
    });

    testWidgets('sin permiso de crear no hay botón Agregar', (tester) async {
      await showScreen(
        tester,
        'stock_solo_ver',
        const AdminStockScreen(),
        height: 1100,
        me: readOnly,
        overrides: [adminStockProvider.overrideWith((ref) async => stock)],
      );
      expect(find.text('Agregar'), findsNothing);
      expect(find.text('Agotado'), findsOneWidget);
    });

    testWidgets('sin carretes cargados invita a agregar el primero', (tester) async {
      await showScreen(
        tester,
        'stock_vacio',
        const AdminStockScreen(),
        me: full,
        overrides: [
          adminStockProvider.overrideWith((ref) async => StockPage.fromJson({'items': <dynamic>[]})),
        ],
      );
      expect(find.text('Todavía no cargaste filamentos'), findsOneWidget);
    });

    testWidgets('tocar un carrete abre su detalle', (tester) async {
      await showScreen(
        tester,
        'stock_a_detalle',
        const AdminStockScreen(),
        height: 1100,
        me: full,
        overrides: [
          adminStockProvider.overrideWith((ref) async => stock),
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) async => movs),
        ],
      );
      await tester.tap(find.text('PLA · Rojo'));
      await settle(tester);
      expect(find.text('Ajustar stock'), findsOneWidget);
    });

    testWidgets('el menú ofrece el informe y copiar los colores', (tester) async {
      await showScreen(
        tester,
        'stock_menu',
        const AdminStockScreen(),
        height: 1100,
        me: full,
        overrides: [
          adminStockProvider.overrideWith((ref) async => stock),
          filamentosApiProvider.overrideWithValue(FakeFilamentosApi()),
        ],
      );
      await tester.tap(find.byTooltip('Más opciones'));
      await settle(tester);
      expect(find.text('Informe de stock'), findsOneWidget);
      expect(find.text('Copiar colores en stock'), findsOneWidget);
      await tester.tap(find.text('Informe de stock'));
      await settle(tester);
      expect(find.textContaining('INFORME DE FILAMENTOS'), findsOneWidget);
      expect(find.text('WhatsApp'), findsOneWidget);
    });
  });

  group('detalle de un carrete', () {
    testWidgets('muestra stock, acciones, costos y movimientos', (tester) async {
      await showScreen(
        tester,
        'filamento_detalle',
        const FilamentoDetailScreen(id: '2'),
        height: 1500,
        me: full,
        overrides: [
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) async => movs),
        ],
      );
      expect(find.text('PLA · Rojo'), findsOneWidget);
      expect(find.text('120 g'), findsOneWidget);
      expect(find.text('Stock bajo'), findsOneWidget);
      expect(find.text('Ajustar stock'), findsOneWidget);
      expect(find.textContaining('Sumar 1 carrete'), findsOneWidget);
      expect(find.text('Costo por kg'), findsOneWidget);
      expect(find.text('Pedido online'), findsOneWidget);
      expect(find.text('-80 g'), findsOneWidget);
      expect(find.text('+1.000 g'), findsOneWidget);
      expect(find.byTooltip('Editar'), findsOneWidget);
      expect(find.byTooltip('Eliminar'), findsOneWidget);
    });

    testWidgets('un stock negativo se muestra como deuda', (tester) async {
      await showScreen(
        tester,
        'filamento_deuda',
        const FilamentoDetailScreen(id: '3'),
        height: 1500,
        me: full,
        overrides: [
          filamentoProvider.overrideWith((ref, id) async => debe),
          filamentMovementsProvider.overrideWith((ref, id) async => <FilamentMovement>[]),
        ],
      );
      expect(find.text('Agotado'), findsOneWidget);
      expect(find.textContaining('Debés 30 g'), findsOneWidget);
      expect(find.textContaining('Todavía no hay movimientos'), findsOneWidget);
    });

    testWidgets('con permiso solo de ver no hay acciones de edición', (tester) async {
      await showScreen(
        tester,
        'filamento_solo_ver',
        const FilamentoDetailScreen(id: '2'),
        height: 1500,
        me: readOnly,
        overrides: [
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) async => movs),
        ],
      );
      expect(find.text('Ajustar stock'), findsNothing);
      expect(find.byTooltip('Editar'), findsNothing);
      expect(find.byTooltip('Eliminar'), findsNothing);
      expect(find.text('Costo por kg'), findsOneWidget);
    });

    testWidgets('sumar un carrete pide confirmación y ajusta por el servidor', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_sumar_carrete',
        const FilamentoDetailScreen(id: '2'),
        height: 1500,
        me: full,
        overrides: [
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) async => movs),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.textContaining('Sumar 1 carrete'));
      await settle(tester);
      await tester.tap(find.widgetWithText(TextButton, 'Sumar'));
      await settle(tester);
      expect(api.adjusts.single.id, '2');
      expect(api.adjusts.single.delta, 1000);
      expect(find.textContaining('Stock: 840 g → 1,84 kg'), findsOneWidget);
    });

    testWidgets('eliminar pide confirmación y borra el carrete', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_eliminar',
        const FilamentoDetailScreen(id: '2'),
        height: 1500,
        me: full,
        overrides: [
          filamentoProvider.overrideWith((ref, id) async => rojo),
          filamentMovementsProvider.overrideWith((ref, id) async => movs),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.byTooltip('Eliminar'));
      await settle(tester);
      expect(find.text('¿Eliminar PLA Rojo?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
      await settle(tester);
      expect(api.deletedId, '2');
    });
  });

  group('ajustar stock', () {
    Future<FakeFilamentosApi> open(WidgetTester tester, {Filamento? f}) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'ajuste_stock',
        Scaffold(body: StockAdjustSheet(filament: f ?? rojo)),
        height: 1000,
        me: full,
        overrides: [filamentosApiProvider.overrideWithValue(api)],
      );
      return api;
    }

    testWidgets('sumar: muestra cómo queda y manda el delta', (tester) async {
      final api = await open(tester);
      expect(find.text('Aplicar ajuste'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos'), '500');
      await tester.pump();
      expect(find.text('Queda en 620 g (+500 g)'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Motivo (opcional)'), 'Compra');
      await tester.tap(find.widgetWithText(GoldButton, 'Aplicar ajuste'));
      await settle(tester);
      expect(api.adjusts.single.delta, 500);
      expect(api.adjusts.single.newStock, isNull);
      expect(api.adjusts.single.reason, 'Compra');
    });

    testWidgets('restar más de lo que hay muestra el error y no deja aplicar', (tester) async {
      final api = await open(tester);
      await tester.tap(find.text('Restar'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Gramos'), '500');
      await tester.pump();
      expect(find.textContaining('No podés restar más de lo que hay'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Aplicar ajuste'));
      await settle(tester);
      expect(api.adjusts, isEmpty);
    });

    testWidgets('contado: manda el stock contado y no el delta', (tester) async {
      final api = await open(tester);
      await tester.tap(find.text('Contado'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Stock contado'), '95,5');
      await tester.pump();
      expect(find.textContaining('Queda en 95,5 g'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Aplicar ajuste'));
      await settle(tester);
      expect(api.adjusts.single.newStock, 95.5);
      expect(api.adjusts.single.delta, isNull);
    });

    testWidgets('los atajos completan el campo', (tester) async {
      await open(tester);
      await tester.tap(find.text('250 g'));
      await tester.pump();
      expect(find.text('Queda en 370 g (+250 g)'), findsOneWidget);
    });

    testWidgets('un rechazo del servidor se ve en la hoja', (tester) async {
      final api = await open(tester);
      api.failWith = ApiException('invalid', 'El stock ya es de 120 g.');
      await tester.enterText(find.widgetWithText(TextField, 'Gramos'), '10');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Aplicar ajuste'));
      await settle(tester);
      expect(find.text('El stock ya es de 120 g.'), findsOneWidget);
    });
  });

  group('formulario de un carrete', () {
    testWidgets('alta: dibuja los campos con los valores por defecto de la web', (tester) async {
      await showScreen(
        tester,
        'filamento_form_alta',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [filamentCatalogProvider.overrideWith((ref) async => catalog)],
      );
      expect(find.text('Nuevo filamento'), findsOneWidget);
      expect(find.text('PLA'), findsOneWidget);
      expect(find.text('Negro'), findsOneWidget);
      expect(find.text('Grilon3'), findsOneWidget);
      expect(find.text('Stock inicial'), findsOneWidget);
      expect(find.text('Agregar filamento'), findsOneWidget);
    });

    testWidgets('alta: manda el filamento con su stock inicial', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_form_guardar',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Stock inicial'), '750');
      await tester.enterText(find.widgetWithText(TextField, 'Costo por kg'), '21500');
      await tester.tap(find.widgetWithText(GoldButton, 'Agregar filamento'));
      await settle(tester);
      final sent = api.created!;
      expect(sent.material, 'PLA');
      expect(sent.stockGrams, 750);
      expect(sent.costPerKg, 21500);
      expect(sent.spoolGrams, 1000);
      expect(sent.toCreateJson()['stockGrams'], 750);
    });

    testWidgets('alta: datos inválidos muestran el error y no llaman al servidor', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_form_errores',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Carrete'), '0');
      await tester.tap(find.widgetWithText(GoldButton, 'Agregar filamento'));
      await settle(tester);
      expect(find.text('El tamaño del carrete tiene que ser mayor a 0.'), findsOneWidget);
      expect(api.created, isNull);
    });

    testWidgets('edición: Guardar espera un cambio y NO manda el stock', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_form_edicion',
        FilamentoFormScreen(filament: rojo),
        height: 1300,
        me: full,
        overrides: [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      expect(find.text('Editar filamento'), findsOneWidget);
      expect(find.text('Stock inicial'), findsNothing);
      expect(find.textContaining('Ajustar stock'), findsOneWidget);

      await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
      await settle(tester);
      expect(api.updated, isNull, reason: 'sin cambios no guarda');

      await tester.enterText(find.widgetWithText(TextField, 'Alerta'), '300');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
      await settle(tester);
      expect(api.updated!.$1, '2');
      expect(api.updated!.$2.alertThresholdGrams, 300);
      expect(api.updated!.$2.toUpdateJson().containsKey('stockGrams'), isFalse);
    });

    testWidgets('un error del servidor se ve en línea', (tester) async {
      final api = FakeFilamentosApi()..failWith = ApiException('invalid', 'Ingresá el material.');
      await showScreen(
        tester,
        'filamento_form_error_servidor',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.widgetWithText(GoldButton, 'Agregar filamento'));
      await settle(tester);
      expect(find.text('Ingresá el material.'), findsOneWidget);
      expect(find.byType(FilamentoFormScreen), findsOneWidget);
    });

    testWidgets('elegir un color del catálogo lo cambia en el formulario', (tester) async {
      await showScreen(
        tester,
        'filamento_form_color',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [filamentCatalogProvider.overrideWith((ref) async => catalog)],
      );
      await tester.tap(find.text('Negro'));
      await settle(tester);
      expect(find.text('Verde militar'), findsOneWidget);
      expect(find.text('Agregar'), findsOneWidget, reason: 'puede crear colores nuevos');
      await tester.tap(find.text('Verde militar'));
      await settle(tester);
      expect(find.text('Verde militar'), findsOneWidget);
      expect(find.text('Negro'), findsNothing);
    });

    testWidgets('agregar una marca nueva la guarda en el catálogo', (tester) async {
      final api = FakeFilamentosApi();
      await showScreen(
        tester,
        'filamento_form_marca_nueva',
        const FilamentoFormScreen(),
        height: 1300,
        me: full,
        overrides: [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Grilon3'));
      await settle(tester);
      await tester.tap(find.text('Agregar'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Bambu Lab');
      await tester.tap(
        find.descendant(of: find.byType(AlertDialog), matching: find.widgetWithText(TextButton, 'Agregar')),
      );
      await settle(tester);
      expect(api.catalogAdds, [('brand', 'Bambu Lab', null)]);
      expect(find.text('Bambu Lab'), findsOneWidget, reason: 'queda elegida en el formulario');
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'filamento_form_fuente_grande',
        const FilamentoFormScreen(),
        width: 360,
        height: 1700,
        textScale: 1.4,
        me: full,
        overrides: [filamentCatalogProvider.overrideWith((ref) async => catalog)],
      );
      expect(find.text('Nuevo filamento'), findsOneWidget);
    });
  });

  group('historial general', () {
    testWidgets('lista todos los movimientos y filtra por motivo', (tester) async {
      await showScreen(
        tester,
        'historial_stock',
        const FilamentMovementsScreen(),
        height: 1000,
        me: full,
        overrides: [filamentMovementsProvider.overrideWith((ref, id) async => movs)],
      );
      expect(find.text('Historial de stock'), findsOneWidget);
      expect(find.text('Pedido online'), findsOneWidget);
      expect(find.text('Impresión fallida'), findsOneWidget);
      // En el historial general se aclara de qué carrete es cada movimiento.
      expect(find.text('PLA · Negro · Lámpara lunar'), findsOneWidget);

      await tester.ensureVisible(find.text('Fallas'));
      await tester.pump();
      await tester.tap(find.text('Fallas'));
      await settle(tester);
      expect(find.text('Pedido online'), findsNothing);
      expect(find.text('Impresión fallida'), findsOneWidget);
    });

    testWidgets('sin movimientos muestra el estado vacío', (tester) async {
      await showScreen(
        tester,
        'historial_vacio',
        const FilamentMovementsScreen(),
        me: full,
        overrides: [filamentMovementsProvider.overrideWith((ref, id) async => <FilamentMovement>[])],
      );
      expect(find.text('Sin movimientos'), findsOneWidget);
    });

    testWidgets('sin permiso de ver muestra "Sin acceso"', (tester) async {
      await showScreen(
        tester,
        'historial_sin_acceso',
        const FilamentMovementsScreen(),
        me: meWith({'filamentos': <String>[]}, role: 'operator'),
        overrides: [filamentMovementsProvider.overrideWith((ref, id) async => movs)],
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });
  });

  // Los tres temas de la app (oscuro, claro y luz nocturna), en un celular chico.
  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('stock, detalle y ajuste en ${mode.name}', (tester) async {
        await showScreen(
          tester,
          'stock_${mode.name}_360',
          const AdminStockScreen(),
          width: 360,
          height: 900,
          mode: mode,
          me: full,
          overrides: [adminStockProvider.overrideWith((ref) async => stock)],
        );
        expect(find.text('Agotado'), findsOneWidget);
        await showScreen(
          tester,
          'filamento_detalle_${mode.name}_360',
          const FilamentoDetailScreen(id: '2'),
          width: 360,
          height: 1300,
          mode: mode,
          me: full,
          overrides: [
            filamentoProvider.overrideWith((ref, id) async => rojo),
            filamentMovementsProvider.overrideWith((ref, id) async => movs),
          ],
        );
        expect(find.text('Ajustar stock'), findsOneWidget);
        await showScreen(
          tester,
          'ajuste_${mode.name}_360',
          Scaffold(body: StockAdjustSheet(filament: rojo)),
          width: 360,
          height: 900,
          mode: mode,
          me: full,
        );
        expect(find.text('Aplicar ajuste'), findsOneWidget);
      });
    }
  });
}
