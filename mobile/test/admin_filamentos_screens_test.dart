import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton;
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/filamentos/filament_types_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamento_detail_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamento_form_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_api.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_models.dart';
import 'package:hefesto/features/admin/filamentos/movements_screen.dart';
import 'package:hefesto/features/admin/filamentos/stock_adjust_sheet.dart';
import 'package:hefesto/features/admin/filamentos/weigh_sheet.dart';
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

  /// Tipos con precio y modelos de carrete que "devuelve el servidor" (vacío
  /// por defecto: las pantallas de siempre no dependen de ellos).
  FilamentTypesData typesData = const FilamentTypesData();
  final typeCreates = <(String name, double costPerKg)>[];
  final typeUpdates = <(String id, String name, double costPerKg)>[];
  final typeDeletes = <String>[];
  final spoolCreates = <(String name, double emptyGrams)>[];
  final spoolUpdates = <(String id, String name, double emptyGrams)>[];
  final spoolDeletes = <String>[];
  final weighs = <({String id, String spoolModelId, double totalGrams, int sealedSpools})>[];

  /// Cuántos carretes "cambiaron de precio" al editar un tipo.
  int typeSpoolsChanged = 3;
  WeighResult weighResult =
      const WeighResult(remainingGrams: 430, newStockGrams: 430, previousStock: 120, changed: true, lowStock: false);

  void _maybeFail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<FilamentTypesData> types() async => typesData;

  @override
  Future<FilamentTypeSaved> createType({required String name, required double costPerKg}) async {
    _maybeFail();
    typeCreates.add((name, costPerKg));
    return const FilamentTypeSaved(id: 't-nuevo');
  }

  @override
  Future<FilamentTypeSaved> updateType(String id, {required String name, required double costPerKg}) async {
    _maybeFail();
    typeUpdates.add((id, name, costPerKg));
    return FilamentTypeSaved(id: id, spools: typeSpoolsChanged);
  }

  @override
  Future<void> deleteType(String id) async {
    _maybeFail();
    typeDeletes.add(id);
  }

  @override
  Future<String> createSpoolModel({required String name, required double emptyGrams}) async {
    _maybeFail();
    spoolCreates.add((name, emptyGrams));
    // Como el servidor: la próxima lista ya lo trae.
    typesData = FilamentTypesData(
      types: typesData.types,
      spoolModels: [...typesData.spoolModels, SpoolModel(id: 's-nuevo', name: name, emptyGrams: emptyGrams)],
    );
    return 's-nuevo';
  }

  @override
  Future<void> updateSpoolModel(String id, {required String name, required double emptyGrams}) async {
    _maybeFail();
    spoolUpdates.add((id, name, emptyGrams));
  }

  @override
  Future<void> deleteSpoolModel(String id) async {
    _maybeFail();
    spoolDeletes.add(id);
  }

  @override
  Future<WeighResult> weigh(String id, {required String spoolModelId, required double totalGrams, int sealedSpools = 0}) async {
    _maybeFail();
    weighs.add((id: id, spoolModelId: spoolModelId, totalGrams: totalGrams, sealedSpools: sealedSpools));
    return weighResult;
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

/// Tipos y modelos de carrete de ejemplo (`GET /admin/filaments/types`).
FilamentTypesData sampleTypes() => FilamentTypesData.fromJson({
      'types': [
        {'id': 't1', 'name': 'PLA', 'costPerKg': 26000, 'spools': 32},
        {'id': 't2', 'name': 'PLA Silk (Dorado)', 'costPerKg': 34000, 'spools': 1},
        {'id': 't3', 'name': 'PETG', 'costPerKg': 31000, 'spools': 0},
      ],
      'spoolModels': [
        {'id': 's1', 'name': 'Grilon3 cartón', 'emptyGrams': 250},
        {'id': 's2', 'name': 'Printalot plástico', 'emptyGrams': 180},
      ],
    });

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

  group('stock de filamentos', () {
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

  group('tipos y precios', () {
    Future<FakeFilamentosApi> open(
      WidgetTester tester,
      String name, {
      FilamentTypesData? data,
      bool canEdit = true,
      double width = 392,
      double textScale = 1.0,
    }) async {
      final api = FakeFilamentosApi()..typesData = data ?? sampleTypes();
      await showScreen(
        tester,
        name,
        const FilamentTypesScreen(),
        width: width,
        height: 1500,
        textScale: textScale,
        me: canEdit ? full : readOnly,
        overrides: [filamentosApiProvider.overrideWithValue(api)],
      );
      return api;
    }

    testWidgets('lista los tipos con su precio y cuántos carretes tienen, y los carretes vacíos', (tester) async {
      await open(tester, 'filamento_tipos');
      expect(find.text('Tipos y precios'), findsOneWidget);
      expect(find.text('PLA'), findsOneWidget);
      expect(find.text('32 carretes'), findsOneWidget);
      expect(find.text('1 carrete'), findsOneWidget);
      expect(find.text('Sin carretes'), findsOneWidget);
      expect(find.textContaining('26.000'), findsOneWidget);
      expect(find.text('Grilon3 cartón'), findsOneWidget);
      expect(find.text('Vacío: 250 g'), findsOneWidget);
      expect(find.text('Agregar tipo'), findsOneWidget);
      expect(find.text('Agregar carrete'), findsOneWidget);
    });

    testWidgets('agregar un tipo manda nombre y precio', (tester) async {
      final api = await open(tester, 'filamento_tipos_alta');
      await tester.tap(find.text('Agregar tipo'));
      await settle(tester);
      expect(find.text('Nuevo tipo'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del tipo'), 'ABS');
      await tester.enterText(find.widgetWithText(TextField, 'Precio por kg'), '29500');
      await tester.pump();
      expect(find.textContaining('29.500'), findsOneWidget, reason: 'muestra cómo se leyó el precio');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.typeCreates, [('ABS', 29500.0)]);
      expect(find.text('Tipo agregado'), findsOneWidget);
    });

    testWidgets('cambiar el precio avisa en cuántos carretes se actualizó', (tester) async {
      final api = await open(tester, 'filamento_tipos_precio');
      api.typeSpoolsChanged = 32;
      await tester.tap(find.text('PLA'));
      await settle(tester);
      expect(find.text('Editar tipo'), findsOneWidget);
      expect(find.textContaining('se aplica a 32 carretes'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Precio por kg'), '28000');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.typeUpdates, [('t1', 'PLA', 28000.0)]);
      expect(find.text('Precio actualizado en 32 carretes'), findsOneWidget);
    });

    testWidgets('cambiar solo el nombre no habla de precios', (tester) async {
      final api = await open(tester, 'filamento_tipos_nombre');
      await tester.tap(find.text('PETG'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del tipo'), 'PETG HF');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.typeUpdates, [('t3', 'PETG HF', 31000.0)]);
      expect(find.text('Tipo guardado'), findsOneWidget);
    });

    testWidgets('un nombre repetido se ve dentro del diálogo y no lo cierra', (tester) async {
      final api = await open(tester, 'filamento_tipos_repetido');
      api.failWith = ApiException('invalid', 'Ya hay un tipo con ese nombre.', status: 422);
      await tester.tap(find.text('Agregar tipo'));
      await settle(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del tipo'), 'PLA');
      await tester.enterText(find.widgetWithText(TextField, 'Precio por kg'), '1');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(find.text('Ya hay un tipo con ese nombre.'), findsOneWidget);
      expect(find.text('Nuevo tipo'), findsOneWidget);
    });

    testWidgets('sin nombre o sin precio no llama al servidor', (tester) async {
      final api = await open(tester, 'filamento_tipos_invalido');
      await tester.tap(find.text('Agregar tipo'));
      await settle(tester);
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(find.text('Ingresá el nombre.'), findsOneWidget);
      expect(api.typeCreates, isEmpty);
    });

    testWidgets('eliminar un tipo pide confirmación y avisa que los carretes quedan sin tipo', (tester) async {
      final api = await open(tester, 'filamento_tipos_borrar');
      await tester.tap(find.byTooltip('Eliminar').first);
      await settle(tester);
      expect(find.text('¿Eliminar el tipo «PLA»?'), findsOneWidget);
      expect(find.textContaining('quedan sin tipo'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await settle(tester);
      expect(api.typeDeletes, isEmpty);
      await tester.tap(find.byTooltip('Eliminar').first);
      await settle(tester);
      await tester.tap(find.text('Eliminar'));
      await settle(tester);
      expect(api.typeDeletes, ['t1']);
      expect(find.text('Tipo eliminado'), findsOneWidget);
    });

    testWidgets('agregar, editar y eliminar un carrete vacío', (tester) async {
      final api = await open(tester, 'filamento_carretes_vacios');
      await tester.tap(find.text('Agregar carrete'));
      await settle(tester);
      expect(find.text('Nuevo carrete'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del carrete'), 'Bambu');
      await tester.enterText(find.widgetWithText(TextField, 'Peso vacío'), '212,5');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.spoolCreates, [('Bambu', 212.5)]);
      expect(find.text('Bambu'), findsOneWidget, reason: 'la lista se vuelve a pedir');

      await tester.tap(find.text('Grilon3 cartón'));
      await settle(tester);
      expect(find.text('Editar carrete'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Peso vacío'), '245');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.spoolUpdates, [('s1', 'Grilon3 cartón', 245.0)]);

      await tester.tap(find.byTooltip('Eliminar').last);
      await settle(tester);
      expect(find.textContaining('¿Eliminar el carrete'), findsOneWidget);
      await tester.tap(find.text('Eliminar'));
      await settle(tester);
      expect(api.spoolDeletes, hasLength(1));
    });

    testWidgets('con permiso solo de ver no hay botones de edición', (tester) async {
      await open(tester, 'filamento_tipos_solo_ver', canEdit: false);
      expect(find.text('PLA'), findsOneWidget);
      expect(find.text('Agregar tipo'), findsNothing);
      expect(find.text('Agregar carrete'), findsNothing);
      expect(find.byTooltip('Eliminar'), findsNothing);
      await tester.tap(find.text('PLA'));
      await settle(tester);
      expect(find.text('Editar tipo'), findsNothing);
    });

    testWidgets('sin tipos ni carretes invita a cargarlos', (tester) async {
      await open(tester, 'filamento_tipos_vacio', data: const FilamentTypesData());
      expect(find.textContaining('Todavía no hay tipos'), findsOneWidget);
      expect(find.text('Todavía no hay carretes cargados.'), findsOneWidget);
    });

    testWidgets('sin overflow a 360 dp con fuente grande (lista y diálogo)', (tester) async {
      await open(tester, 'filamento_tipos_fuente_grande', width: 360, textScale: 1.4);
      await tester.tap(find.text('PLA Silk (Dorado)'));
      await settle(tester);
      expect(find.text('Editar tipo'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('calcular filamento (pesar el carrete)', () {
    Future<FakeFilamentosApi> open(
      WidgetTester tester,
      String name, {
      Filamento? f,
      FilamentTypesData? data,
      double width = 392,
      double textScale = 1.0,
    }) async {
      final api = FakeFilamentosApi()..typesData = data ?? sampleTypes();
      await showScreen(
        tester,
        name,
        Scaffold(body: WeighSheet(filament: f ?? rojo)),
        width: width,
        height: 1100,
        textScale: textScale,
        me: full,
        overrides: [filamentosApiProvider.overrideWithValue(api)],
      );
      return api;
    }

    final total = find.widgetWithText(TextField, 'Peso del carrete con filamento');
    final sealed = find.widgetWithText(TextField, 'Carretes cerrados aparte');
    final confirm = find.widgetWithText(GoldButton, 'Confirmar y actualizar stock');

    testWidgets('elige el modelo, tipea el peso y ve en vivo cuánto queda', (tester) async {
      final api = await open(tester, 'pesar_carrete');
      expect(find.text('Calcular filamento'), findsOneWidget);
      expect(find.text('Grilon3 cartón (250 g)'), findsOneWidget);
      expect(find.text('Printalot plástico (180 g)'), findsOneWidget);
      expect(tester.widget<GoldButton>(confirm).onPressed, isNull, reason: 'falta el modelo y el peso');

      await tester.enterText(total, '680');
      await tester.pump();
      expect(find.byKey(const ValueKey('weigh-preview')), findsNothing, reason: 'todavía no eligió el modelo');
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.pump();
      expect(find.text('Carrete vacío: 250 g · Filamento restante: 430 g'), findsOneWidget);
      expect(find.textContaining('Stock total'), findsNothing);

      await tester.tap(confirm);
      await settle(tester);
      expect(api.weighs.single, (id: '2', spoolModelId: 's1', totalGrams: 680.0, sealedSpools: 0));
    });

    testWidgets('con carretes cerrados muestra y manda el stock total', (tester) async {
      final api = await open(tester, 'pesar_carrete_cerrados');
      await tester.tap(find.text('Printalot plástico (180 g)'));
      await tester.enterText(total, '680');
      await tester.enterText(sealed, '2');
      await tester.pump();
      expect(find.text('Carrete vacío: 180 g · Filamento restante: 500 g'), findsOneWidget);
      expect(find.text('Stock total: 2,50 kg (con 2 carretes cerrados)'), findsOneWidget);
      await tester.tap(confirm);
      await settle(tester);
      expect(api.weighs.single.sealedSpools, 2);
      expect(api.weighs.single.spoolModelId, 's2');
    });

    testWidgets('el modelo con el que se pesó la última vez viene elegido', (tester) async {
      final conModelo = Filamento.fromJson({...filJson('2', 'Rojo', '#CC2200', 120, 'bajo'), 'spoolModelId': 's2'});
      final api = await open(tester, 'pesar_carrete_recordado', f: conModelo);
      await tester.enterText(total, '300');
      await tester.pump();
      expect(find.text('Carrete vacío: 180 g · Filamento restante: 120 g'), findsOneWidget);
      await tester.tap(confirm);
      await settle(tester);
      expect(api.weighs.single.spoolModelId, 's2');
    });

    testWidgets('si pesa menos que el carrete vacío no deja confirmar', (tester) async {
      final api = await open(tester, 'pesar_carrete_error');
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.enterText(total, '200');
      await tester.pump();
      expect(find.textContaining('vacío pesa 250 g'), findsOneWidget);
      expect(tester.widget<GoldButton>(confirm).onPressed, isNull);
      expect(api.weighs, isEmpty);
    });

    testWidgets('un rechazo del servidor se ve en la hoja', (tester) async {
      final api = await open(tester, 'pesar_carrete_rechazo');
      api.failWith = ApiException('invalid', 'El modelo de carrete ya no existe. Elegí otro.', status: 422);
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.enterText(total, '680');
      await tester.pump();
      await tester.tap(confirm);
      await settle(tester);
      expect(find.text('El modelo de carrete ya no existe. Elegí otro.'), findsOneWidget);
    });

    testWidgets('sin modelos de carrete invita a agregar uno y lo deja elegido', (tester) async {
      final api = await open(tester, 'pesar_carrete_sin_modelos', data: const FilamentTypesData());
      expect(find.textContaining('Todavía no cargaste ningún modelo de carrete'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Agregar un carrete'));
      await settle(tester);
      expect(find.text('Nuevo carrete'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre del carrete'), 'Bambu');
      await tester.enterText(find.widgetWithText(TextField, 'Peso vacío'), '210');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.spoolCreates, [('Bambu', 210.0)]);
      expect(find.text('Bambu (210 g)'), findsOneWidget);
      await tester.enterText(total, '710');
      await tester.pump();
      expect(find.text('Carrete vacío: 210 g · Filamento restante: 500 g'), findsOneWidget);
    });

    testWidgets('desde la hoja se edita y se elimina el modelo elegido', (tester) async {
      final api = await open(tester, 'pesar_carrete_modelos');
      expect(find.text('Editar'), findsNothing, reason: 'sin modelo elegido no hay qué editar');
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.pump();
      await tester.tap(find.text('Editar'));
      await settle(tester);
      expect(find.text('Editar carrete'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Peso vacío'), '240');
      await tester.tap(find.text('Guardar'));
      await settle(tester);
      expect(api.spoolUpdates, [('s1', 'Grilon3 cartón', 240.0)]);

      await tester.tap(find.text('Eliminar'));
      await settle(tester);
      await tester.tap(find.text('Eliminar').last);
      await settle(tester);
      expect(api.spoolDeletes, ['s1']);
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await open(tester, 'pesar_carrete_fuente_grande', width: 360, textScale: 1.4);
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.enterText(total, '680');
      await tester.enterText(sealed, '3');
      await tester.pump();
      expect(find.textContaining('Stock total'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });

  group('tipo de filamento en el carrete', () {
    List<Override> ov(FakeFilamentosApi api, {Filamento? detail}) => [
          filamentCatalogProvider.overrideWith((ref) async => catalog),
          filamentosApiProvider.overrideWithValue(api),
          if (detail != null) ...[
            filamentoProvider.overrideWith((ref, id) async => detail),
            filamentMovementsProvider.overrideWith((ref, id) async => movs),
          ],
        ];
    final conTipo = Filamento.fromJson({...filJson('2', 'Rojo', '#CC2200', 120, 'bajo', cost: 26000), 'typeId': 't1'});

    testWidgets('alta: al elegir un tipo el costo lo pone el tipo y viaja typeId', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_form_tipo', const FilamentoFormScreen(),
          height: 1400, me: full, overrides: ov(api));
      expect(find.text('Tipo (precio)'), findsOneWidget);
      expect(find.text('Sin tipo (precio propio)'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Costo por kg'), findsOneWidget);

      await tester.tap(find.text('Sin tipo (precio propio)'));
      await settle(tester);
      expect(find.text('PLA Silk (Dorado)'), findsOneWidget);
      await tester.tap(find.text('PLA Silk (Dorado)'));
      await settle(tester);

      expect(find.widgetWithText(TextField, 'Costo por kg'), findsNothing, reason: 'el costo ya no se tipea');
      expect(find.byKey(const ValueKey('cost-from-type')), findsOneWidget);
      expect(find.textContaining('Lo pone el tipo «PLA Silk (Dorado)»'), findsOneWidget);

      await tester.tap(find.widgetWithText(GoldButton, 'Agregar filamento'));
      await settle(tester);
      expect(api.created!.typeId, 't2');
      expect(api.created!.costPerKg, 34000);
      expect(api.created!.toCreateJson()['typeId'], 't2');
    });

    testWidgets('alta sin tipo: el costo se tipea como siempre y typeId viaja null', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_form_sin_tipo', const FilamentoFormScreen(),
          height: 1400, me: full, overrides: ov(api));
      await tester.enterText(find.widgetWithText(TextField, 'Costo por kg'), '21500');
      await tester.tap(find.widgetWithText(GoldButton, 'Agregar filamento'));
      await settle(tester);
      expect(api.created!.typeId, isNull);
      expect(api.created!.costPerKg, 21500);
      expect(api.created!.toCreateJson().containsKey('typeId'), isTrue);
    });

    testWidgets('edición: quitarle el tipo vuelve al precio propio y guarda typeId null', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_form_quitar_tipo', FilamentoFormScreen(filament: conTipo),
          height: 1400, me: full, overrides: ov(api));
      expect(find.textContaining('PLA — '), findsOneWidget);
      expect(find.byKey(const ValueKey('cost-from-type')), findsOneWidget);

      await tester.tap(find.textContaining('PLA — '));
      await settle(tester);
      await tester.tap(find.text('Sin tipo (precio propio)'));
      await settle(tester);
      expect(find.widgetWithText(TextField, 'Costo por kg'), findsOneWidget);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
      await settle(tester);
      expect(api.updated!.$2.typeId, isNull);
      expect(api.updated!.$2.toUpdateJson()['typeId'], isNull);
    });

    testWidgets('edición: cambiar de tipo alcanza para poder guardar', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_form_cambiar_tipo', FilamentoFormScreen(filament: conTipo),
          height: 1400, me: full, overrides: ov(api));
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
      await settle(tester);
      expect(api.updated, isNull, reason: 'sin cambios no guarda');
      await tester.tap(find.textContaining('PLA — '));
      await settle(tester);
      await tester.tap(find.text('PETG'));
      await settle(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Guardar cambios'));
      await settle(tester);
      expect(api.updated!.$2.typeId, 't3');
    });

    testWidgets('el selector lleva a "Tipos y precios"', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_form_ir_a_tipos', const FilamentoFormScreen(),
          height: 1400, me: full, overrides: ov(api));
      await tester.tap(find.text('Sin tipo (precio propio)'));
      await settle(tester);
      await tester.tap(find.text('Tipos y precios'));
      await settle(tester);
      expect(find.byType(FilamentTypesScreen), findsOneWidget);
    });

    testWidgets('detalle: el tipo se ve al lado del costo y está "Calcular filamento"', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_detalle_tipo', const FilamentoDetailScreen(id: '2'),
          height: 1600, me: full, overrides: ov(api, detail: conTipo));
      expect(find.textContaining(' · PLA'), findsWidgets);
      expect(find.text('Calcular filamento'), findsOneWidget);
      expect(find.text('Tipos y precios'), findsOneWidget);

      await tester.tap(find.text('Calcular filamento'));
      await settle(tester);
      expect(find.text('Confirmar y actualizar stock'), findsOneWidget);
      await tester.tap(find.text('Grilon3 cartón (250 g)'));
      await tester.enterText(find.widgetWithText(TextField, 'Peso del carrete con filamento'), '680');
      await tester.pump();
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar y actualizar stock'));
      await settle(tester);
      expect(api.weighs.single.totalGrams, 680);
      expect(find.text('Confirmar y actualizar stock'), findsNothing, reason: 'la hoja se cierra');
      expect(find.text('Quedan 430 g en el carrete · stock: 120 g → 430 g'), findsOneWidget);
    });

    testWidgets('detalle con permiso solo de ver: sin "Calcular filamento"', (tester) async {
      final api = FakeFilamentosApi()..typesData = sampleTypes();
      await showScreen(tester, 'filamento_detalle_tipo_solo_ver', const FilamentoDetailScreen(id: '2'),
          height: 1600, me: readOnly, overrides: ov(api, detail: conTipo));
      expect(find.text('Calcular filamento'), findsNothing);
      expect(find.text('Tipos y precios'), findsOneWidget);
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
