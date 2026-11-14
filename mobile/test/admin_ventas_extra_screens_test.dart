import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/sale_detail_screen.dart';
import 'package:hefesto/features/admin/sales_screen.dart';
import 'package:hefesto/features/admin/ventas_extra/manual_sale_edit_screen.dart';
import 'package:hefesto/features/admin/ventas_extra/manual_sale_form_screen.dart';
import 'package:hefesto/features/admin/ventas_extra/ventas_extra_api.dart';
import 'package:hefesto/features/admin/ventas_extra/ventas_extra_models.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Dibuja la carga / edición / baja de ventas con datos de ejemplo, a 360dp de
/// ancho (el celu más angosto) y con fuente grande. Con SHOT_DIR=ruta guarda un
/// PNG de cada pantalla para revisarlas a ojo.
final _shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

MeInfo _me({
  String role = 'admin',
  Map<String, bool> pedidos = const {'ver': true, 'crear': true, 'editar': true, 'eliminar': true},
}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': role,
      'isStaff': true,
      'permissions': {'pedidos': pedidos},
    });

final _formData = SaleFormData.fromJson({
  'categories': ['Llaveros', 'Mates', 'Porta sahumerios'],
  'recentCustomers': ['Juan Pérez', 'Ana Gómez', 'Cliente de feria'],
});

final _catalog = SaleCatalogPage.fromJson({
  'total': 3,
  'items': [
    {
      'id': 'p1',
      'name': 'Mate Mario',
      'categoryName': 'Mates',
      'price': 30000,
      'colorMode': 'single',
      'colors': [
        {'name': 'Rojo', 'hex': '#CC2200'},
        {'name': 'Blanco', 'hex': '#F2F2F2'},
        {'name': 'Verde militar', 'hex': null},
      ],
      'variants': ['Chico', 'Grande'],
      'options': [
        for (final v in ['Chico', 'Grande'])
          for (final c in ['Rojo', 'Blanco', 'Verde militar'])
            {
              'variantLabel': v,
              'color': c,
              'unitPrice': v == 'Chico' ? 30000 : 45000,
              'weightGrams': v == 'Chico' ? 120 : 250,
              'extrasCost': 0,
              'hasStock': c != 'Verde militar',
            },
      ],
    },
    {
      'id': 'p2',
      'name': 'Llavero personalizado con nombre y color a elección del cliente',
      'categoryName': 'Llaveros',
      'price': 2500,
      'colorMode': 'single',
      'colors': [
        {'name': 'Negro', 'hex': '#111111'},
      ],
      'variants': <dynamic>[],
      'options': [
        {'variantLabel': null, 'color': 'Negro', 'unitPrice': 2500, 'weightGrams': 8, 'extrasCost': 100, 'hasStock': true},
      ],
    },
    {
      'id': 'p3',
      'name': 'Cartel a medida',
      'categoryName': null,
      'price': 12000,
      'colorMode': 'multi',
      'colors': <dynamic>[],
      'variants': <dynamic>[],
      'options': [
        {'variantLabel': null, 'color': null, 'unitPrice': 12000, 'weightGrams': 0, 'extrasCost': 0, 'hasStock': false},
      ],
    },
  ],
});

final _editData = ManualSaleEditData.fromJson({
  'id': 'm1',
  'saleDate': '2026-10-29T12:00:00.000Z',
  'customerName': 'Cliente de feria',
  'detail': '5 llaveros personalizados',
  'category': 'Llaveros',
  'status': 'delivered',
  'paymentMethod': 'cash',
  'quantity': 5,
  'total': 10000,
  'amortization': 3500,
  'profit': 6500,
  'items': <dynamic>[],
});

final _manualDetail = SaleDetail.manual({
  'id': 'm1',
  'saleDate': '2026-10-29T12:00:00.000Z',
  'customerName': 'Cliente de feria',
  'detail': '5 llaveros',
  'category': 'Llaveros',
  'status': 'delivered',
  'paymentMethod': 'cash',
  'quantity': 5,
  'total': 10000,
  'items': <dynamic>[],
});

final _onlineDetail = SaleDetail.online({
  'id': 'o1',
  'orderNumber': 'HF-0042',
  'status': 'ready',
  'paymentMethod': 'mercadopago',
  'subtotal': 60000,
  'discountAmount': 0,
  'shippingCost': 0,
  'total': 60000,
  'shippingAddress': {'fullName': 'Juan Pérez', 'phone': '+54 3757 624148', 'deliveryType': 'pickup'},
  'createdAt': '2026-10-30T15:00:00.000Z',
  'customer': {'fullName': 'Juan Pérez', 'phone': '+54 3757 624148'},
  'items': [
    {'id': 'i1', 'productName': 'Mate Mario', 'variantLabel': 'Rojo', 'unitPrice': 30000, 'quantity': 2, 'lineTotal': 60000},
  ],
  'history': <dynamic>[],
});

final _sales = SalesPage.fromJson({
  'total': 1,
  'items': [
    {'id': 'b', 'source': 'manual', 'date': '2026-10-29T10:00:00.000Z', 'customerName': 'Cliente de feria', 'label': '5 llaveros', 'ref': null, 'paymentMethod': 'cash', 'status': 'delivered', 'total': 10000},
  ],
});

/// La API de ventas, falsa: guarda lo que le mandan y puede fallar a pedido.
class _FakeApi implements VentasExtraApi {
  Map<String, dynamic>? created;
  Map<String, dynamic>? edited;
  String? deletedManual;
  String? deletedOrder;
  Object? failWith;

  void _maybeFail() {
    if (failWith != null) throw failWith!;
  }

  @override
  Future<CreatedSale> createManualSale(Map<String, dynamic> body) async {
    _maybeFail();
    created = body;
    return CreatedSale(id: 'nueva', total: 6000);
  }

  @override
  Future<void> editManualSale(String id, Map<String, dynamic> body) async {
    _maybeFail();
    edited = {'id': id, ...body};
  }

  @override
  Future<void> deleteManualSale(String id) async {
    _maybeFail();
    deletedManual = id;
  }

  @override
  Future<void> deleteOrder(String id) async {
    _maybeFail();
    deletedOrder = id;
  }

  @override
  Future<SaleCatalogPage> catalog({String q = '', int limit = 30}) async => _catalog;

  @override
  Future<SaleFormData> formData() async => _formData;

  @override
  Future<ManualSaleEditData> manualSale(String id) async => _editData;
}

final _shotKey = GlobalKey();

/// Arma la app con una pantalla base y empuja [screen] encima (así `pop` anda).
Future<void> _open(
  WidgetTester tester,
  Widget screen, {
  double width = 360,
  double height = 800,
  double textScale = 1,
  MeInfo? me,
  _FakeApi? api,
  List<Override> overrides = const [],
  bool push = true,
  bool editLoadFails = false,
  HefestoThemeMode mode = HefestoThemeMode.dark,
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me ?? _me()),
        ventasExtraApiProvider.overrideWithValue(api ?? _FakeApi()),
        saleFormDataProvider.overrideWith((ref) async => _formData),
        saleCatalogProvider.overrideWith((ref, q) async => _catalog),
        if (editLoadFails)
          manualSaleEditProvider.overrideWith((ref, id) => throw Exception('boom'))
        else
          manualSaleEditProvider.overrideWith((ref, id) async => _editData),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: _shotKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(mode),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: push ? const Scaffold(body: Center(child: Text('base'))) : screen,
        ),
      ),
    ),
  );
  if (push) {
    tester.state<NavigatorState>(find.byType(Navigator).first).push(
          MaterialPageRoute<void>(builder: (_) => screen),
        );
  }
  await _settle(tester);
}

/// Sin pumpAndSettle: los esqueletos y los spinners animan para siempre.
Future<void> _settle(WidgetTester tester, [int times = 8]) async {
  for (var i = 0; i < times; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _shot(WidgetTester tester, String name) async {
  if (_shotDir == null) return;
  await tester.runAsync(() async {
    final boundary = _shotKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
    final image = await boundary.toImage(pixelRatio: 1.2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    await File('$_shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
  });
}

void _noOverflow(WidgetTester tester, String name) {
  expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');
}

Finder _field(String label) => find.widgetWithText(TextField, label);

/// ¿El botón dorado con ese texto está habilitado?
bool _goldEnabled(WidgetTester tester, String label) {
  final b = tester.widget<GoldButton>(find.widgetWithText(GoldButton, label));
  return b.onPressed != null;
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    // Con las tipografías REALES de la marca: sin ellas el test usa una fuente
    // de cajas anchas y marca desbordes que en el celu no existen.
    await _loadFont('Orbitron', ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf']);
    await _loadFont('Sora', [
      'assets/fonts/Sora-Regular.ttf',
      'assets/fonts/Sora-Medium.ttf',
      'assets/fonts/Sora-SemiBold.ttf',
      'assets/fonts/Sora-Bold.ttf',
    ]);
    if (_shotDir != null) {
      Directory(_shotDir!).createSync(recursive: true);
      final root = Platform.environment['FLUTTER_ROOT'];
      if (root != null) {
        await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
      }
    }
  });

  group('Nueva venta', () {
    testWidgets('formulario vacío: 360dp, fuente grande, dice qué falta', (tester) async {
      await _open(tester, const ManualSaleFormScreen(), textScale: 1.3, height: 1500);
      expect(find.text('Nueva venta'), findsOneWidget);
      expect(find.text('Falta el nombre del cliente.'), findsOneWidget);
      expect(find.text('Registrar venta'), findsOneWidget);
      expect(_goldEnabled(tester, 'Registrar venta'), isFalse);
      // Clientes anteriores para autocompletar.
      expect(find.text('Juan Pérez'), findsOneWidget);
      _noOverflow(tester, 'form_vacio');
      await _shot(tester, 'ventas_extra_form_vacio');
    });

    testWidgets('cargar una venta de texto libre con insumo y registrarla', (tester) async {
      final api = _FakeApi();
      await _open(tester, const ManualSaleFormScreen(), api: api, height: 1100);

      await tester.enterText(_field('Nombre del cliente'), 'Marta');
      await tester.pump();
      expect(find.text('Agregá al menos un producto.'), findsOneWidget);

      await tester.tap(find.text('Texto libre').first);
      await _settle(tester);
      await tester.enterText(_field('Qué se vendió'), 'Reparación de figura');
      await tester.enterText(_field('Precio c/u'), '3000');
      await tester.pump();
      // Sin costo no deja agregar: el costo se pide explícito.
      await tester.tap(find.textContaining('Agregar ·'));
      await tester.pump();
      expect(find.text('Poné el costo (0 si no tuvo).'), findsOneWidget);
      await tester.enterText(_field('Costo c/u'), '500');
      await tester.tap(find.byTooltip('Más').last);
      await tester.pump();
      await tester.tap(find.textContaining('Agregar ·'));
      await _settle(tester);

      // La línea quedó en la venta: 2 × $3.000.
      expect(find.text('Reparación de figura'), findsOneWidget);
      expect(find.text(r'$6.000'), findsWidgets);
      expect(find.text('Texto libre · no descuenta stock'), findsOneWidget);
      expect(_goldEnabled(tester, 'Registrar venta'), isTrue);
      _noOverflow(tester, 'form_con_linea');

      // Un insumo cargado a mano se cobra: suma al total.
      await tester.ensureVisible(find.text('Agregar insumo'));
      await tester.tap(find.text('Agregar insumo'));
      await tester.pump();
      await tester.enterText(_field('Insumo (ej: argollas)'), 'Argollas');
      await tester.enterText(_field('Costo c/u'), '150');
      await tester.pump();
      expect(find.text(r'$6.150'), findsWidgets);
      await _settle(tester, 4);
      await _shot(tester, 'ventas_extra_form_cargado');

      await tester.tap(find.text('Registrar venta'));
      await _settle(tester);

      final body = api.created!;
      expect(body['customerName'], 'Marta');
      expect(body['paymentMethod'], 'cash');
      expect(body['status'], 'pending_payment');
      expect((body['items'] as List).single, {
        'productName': 'Reparación de figura',
        'quantity': 2,
        'unitPrice': 3000.0,
        'unitCost': 500.0,
      });
      expect(body['extras'], [
        {'name': 'Argollas', 'cost': 150.0, 'qty': 1},
      ]);
      // Volvió a la pantalla anterior y avisó.
      expect(find.text('Nueva venta'), findsNothing);
      expect(find.textContaining('Venta registrada: Marta'), findsOneWidget);
    });

    testWidgets('elegir del catálogo: tamaño, color y precio de la tienda', (tester) async {
      final api = _FakeApi();
      await _open(tester, const ManualSaleFormScreen(), api: api, height: 1200);

      await tester.enterText(_field('Nombre del cliente'), 'Juan Pérez');
      await tester.tap(find.text('Catálogo'));
      await _settle(tester);

      expect(find.text('Elegir producto'), findsOneWidget);
      expect(find.text('Mate Mario'), findsOneWidget);
      expect(find.text('Sin carrete'), findsOneWidget); // el cartel multicolor
      expect(find.text('desde \$30.000'), findsOneWidget);
      _noOverflow(tester, 'catalogo');
      await _shot(tester, 'ventas_extra_catalogo');

      await tester.tap(find.text('Mate Mario'));
      await _settle(tester);
      // Hoja del producto: elige tamaño y el precio sigue al de la tienda.
      expect(find.text('¿Qué tamaño?'), findsOneWidget);
      expect(find.text('Es el precio de la tienda para esta elección.'), findsOneWidget);
      await tester.tap(find.text('Grande'));
      await tester.pump();
      expect(find.widgetWithText(TextField, '45000'), findsOneWidget);
      await tester.tap(find.text('Blanco'));
      await tester.pump();
      _noOverflow(tester, 'catalogo_hoja');
      await _shot(tester, 'ventas_extra_catalogo_hoja');
      await tester.tap(find.textContaining('Agregar ·'));
      await _settle(tester);
      expect(find.text('Agregado: Mate Mario'), findsOneWidget);

      await tester.tap(find.text('Listo (1)'));
      await _settle(tester);

      // En la venta: nombre, tamaño · color, y que descuenta stock.
      expect(find.text('Mate Mario'), findsOneWidget);
      expect(find.text('Grande · Blanco'), findsOneWidget);
      expect(find.text('Descuenta stock'), findsOneWidget);
      // La categoría del producto quedó elegida para la venta.
      await tester.scrollUntilVisible(
        find.widgetWithText(ChoiceChip, 'Mates'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      final mates = tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Mates'));
      expect(mates.selected, isTrue);
      expect(_goldEnabled(tester, 'Registrar venta'), isTrue);
      _noOverflow(tester, 'form_catalogo');

      await tester.tap(find.text('Registrar venta'));
      await _settle(tester);
      final item = (api.created!['items'] as List).single as Map;
      expect(item['productId'], 'p1');
      expect(item['variantLabel'], 'Grande');
      expect(item['color'], 'Blanco');
      expect(item['unitPrice'], 45000.0);
      expect(item.containsKey('unitCost'), isFalse); // con carrete, el costo sale del filamento
      expect(api.created!['category'], 'Mates');
    });

    testWidgets('el mismo producto otra vez: con el mismo precio se suma, con otro precio va aparte', (tester) async {
      final api = _FakeApi();
      await _open(tester, const ManualSaleFormScreen(), api: api, height: 1400);
      await tester.enterText(_field('Nombre del cliente'), 'Juan');
      await tester.tap(find.text('Catálogo'));
      await _settle(tester);
      // Dos veces al precio de la tienda ($30.000) y una tercera con descuento.
      for (final price in [null, null, '25000']) {
        await tester.tap(find.text('Mate Mario'));
        await _settle(tester);
        if (price != null) {
          await tester.enterText(_field('Precio c/u'), price);
          await tester.pump();
        }
        await tester.tap(find.textContaining('Agregar ·'));
        await _settle(tester);
      }
      await tester.tap(find.text('Listo (3)'));
      await _settle(tester);
      _noOverflow(tester, 'form_dos_precios');

      await tester.tap(find.text('Registrar venta'));
      await _settle(tester);
      final items = (api.created!['items'] as List).cast<Map<String, dynamic>>();
      expect(items.length, 2, reason: 'la unidad con descuento no se mezcla con las otras');
      expect(items[0]['quantity'], 2);
      expect(items[0]['unitPrice'], 30000.0);
      expect(items[1]['quantity'], 1);
      expect(items[1]['unitPrice'], 25000.0, reason: 'se cobra el precio que se tipeó, no el de la línea anterior');
    });

    testWidgets('un producto sin carrete pide el costo antes de registrar', (tester) async {
      await _open(tester, const ManualSaleFormScreen(), height: 1300);
      await tester.enterText(_field('Nombre del cliente'), 'Ana');
      await tester.tap(find.text('Catálogo'));
      await _settle(tester);
      await tester.tap(find.text('Cartel a medida'));
      await _settle(tester);
      expect(find.textContaining('Sin carrete ni gramos cargados'), findsOneWidget);
      await tester.tap(find.textContaining('Agregar ·'));
      await _settle(tester);
      await tester.tap(find.text('Listo (1)'));
      await _settle(tester);

      expect(find.text('Sin carrete: cargá el costo'), findsOneWidget);
      expect(find.textContaining('Cargá el costo de "Cartel a medida"'), findsOneWidget);
      expect(_goldEnabled(tester, 'Registrar venta'), isFalse);
      await tester.enterText(_field('Costo c/u'), '0');
      await tester.pump();
      expect(_goldEnabled(tester, 'Registrar venta'), isTrue);
      _noOverflow(tester, 'form_sin_carrete');
    });

    testWidgets('el error del servidor se ve en línea y la venta no se pierde', (tester) async {
      final api = _FakeApi()
        ..failWith = ApiException('invalid', 'El producto «Mate» ya no está en el catálogo.', status: 422);
      await _open(tester, const ManualSaleFormScreen(), api: api, height: 1100);
      await tester.enterText(_field('Nombre del cliente'), 'Ana');
      await tester.tap(find.text('Texto libre').first);
      await _settle(tester);
      await tester.enterText(_field('Qué se vendió'), 'Algo');
      await tester.enterText(_field('Precio c/u'), '1000');
      await tester.enterText(_field('Costo c/u'), '0');
      await tester.tap(find.textContaining('Agregar ·'));
      await _settle(tester);

      await tester.tap(find.text('Registrar venta'));
      await _settle(tester);
      expect(find.textContaining('ya no está en el catálogo'), findsOneWidget);
      expect(find.text('Nueva venta'), findsOneWidget, reason: 'sigue en el formulario');
      expect(api.created, isNull);
      expect(_goldEnabled(tester, 'Registrar venta'), isTrue, reason: 'se puede reintentar');
    });

    testWidgets('salir con datos cargados pide confirmación', (tester) async {
      await _open(tester, const ManualSaleFormScreen(), height: 900);
      await tester.enterText(_field('Nombre del cliente'), 'Ana');
      await tester.pump();
      // Atrás del sistema.
      final dynamic widgetsAppState = tester.state(find.byType(WidgetsApp));
      await widgetsAppState.didPopRoute();
      await _settle(tester);
      expect(find.text('¿Descartar la venta?'), findsOneWidget);
      await tester.tap(find.text('Seguir cargando'));
      await _settle(tester);
      expect(find.text('Nueva venta'), findsOneWidget);
    });
  });

  group('Los 3 temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('formulario y edición en ${mode.label}', (tester) async {
        await _open(tester, const ManualSaleFormScreen(), mode: mode, height: 1300);
        await tester.enterText(_field('Nombre del cliente'), 'Marta');
        await tester.tap(find.text('Texto libre').first);
        await _settle(tester);
        await tester.enterText(_field('Qué se vendió'), 'Reparación de figura');
        await tester.enterText(_field('Precio c/u'), '3000');
        await tester.enterText(_field('Costo c/u'), '500');
        await tester.tap(find.textContaining('Agregar ·'));
        await _settle(tester);
        _noOverflow(tester, 'form_${mode.name}');
        await _shot(tester, 'ventas_extra_form_${mode.name}_360');

        await _open(tester, const ManualSaleEditScreen(saleId: 'm1'), mode: mode, height: 1500);
        _noOverflow(tester, 'edicion_${mode.name}');
        await _shot(tester, 'ventas_extra_editar_${mode.name}_360');
      });
    }
  });

  group('Editar venta', () {
    testWidgets('carga los datos, avisa la ganancia y guarda solo con cambios', (tester) async {
      final api = _FakeApi();
      await _open(tester, const ManualSaleEditScreen(saleId: 'm1'), api: api, textScale: 1.3, height: 1700);

      expect(find.text('Editar venta'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Cliente de feria'), findsOneWidget);
      expect(find.widgetWithText(TextField, '10000'), findsOneWidget);
      expect(find.widgetWithText(TextField, '3500'), findsOneWidget);
      expect(find.text(r'$6.500'), findsOneWidget); // ganancia = 10.000 − 3.500
      expect(_goldEnabled(tester, 'Guardar cambios'), isFalse, reason: 'sin cambios no se guarda');
      _noOverflow(tester, 'edicion');
      await _shot(tester, 'ventas_extra_editar');

      await tester.enterText(_field('Costo (material + insumos)'), '4000');
      await tester.pump();
      expect(find.text(r'$6.000'), findsOneWidget); // la ganancia se recalcula en vivo
      expect(_goldEnabled(tester, 'Guardar cambios'), isTrue);

      await tester.tap(find.text('Guardar cambios'));
      await _settle(tester);
      expect(api.edited, {
        'id': 'm1',
        'saleDate': saleDateParam(_editData.saleDate),
        'customerName': 'Cliente de feria',
        'detail': '5 llaveros personalizados',
        'category': 'Llaveros',
        'total': 10000.0,
        'amortization': 4000.0,
        'paymentMethod': 'cash',
      });
      expect(find.text('Editar venta'), findsNothing);
      expect(find.text('Venta actualizada'), findsOneWidget);
    });

    testWidgets('sin nombre o sin total no deja guardar', (tester) async {
      await _open(tester, const ManualSaleEditScreen(saleId: 'm1'), height: 1500);
      await tester.enterText(_field('Nombre del cliente'), '  ');
      await tester.pump();
      expect(find.text('Falta el nombre del cliente.'), findsOneWidget);
      expect(_goldEnabled(tester, 'Guardar cambios'), isFalse);
      await tester.enterText(_field('Nombre del cliente'), 'Ana');
      await tester.enterText(_field('Total cobrado'), '');
      await tester.pump();
      expect(find.text('Poné el total cobrado.'), findsOneWidget);
    });

    testWidgets('un error al cargar se muestra con Reintentar', (tester) async {
      await _open(
        tester,
        const ManualSaleEditScreen(saleId: 'm1'),
        editLoadFails: true,
      );
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  group('Menú del detalle', () {
    Future<void> openMenu(WidgetTester tester) async {
      await tester.tap(find.byIcon(Icons.more_vert_rounded));
      await _settle(tester, 4);
    }

    testWidgets('venta de mostrador, admin: editar, comprobante y eliminar', (tester) async {
      await _open(
        tester,
        const SaleDetailScreen(source: 'manual', id: 'm1'),
        height: 1100,
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
      );
      await openMenu(tester);
      expect(find.text('Editar venta'), findsOneWidget);
      expect(find.text('Ver comprobante'), findsOneWidget);
      expect(find.text('Eliminar venta'), findsOneWidget);
      await _shot(tester, 'ventas_extra_menu');
    });

    testWidgets('pedido online, admin: solo comprobante y eliminar (sin editar)', (tester) async {
      await _open(
        tester,
        const SaleDetailScreen(source: 'online', id: 'o1'),
        height: 1700,
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _onlineDetail)],
      );
      await openMenu(tester);
      expect(find.text('Editar venta'), findsNothing);
      expect(find.text('Ver comprobante'), findsOneWidget);
      expect(find.text('Eliminar pedido'), findsOneWidget);
    });

    testWidgets('operador: puede editar pero NO eliminar', (tester) async {
      await _open(
        tester,
        const SaleDetailScreen(source: 'manual', id: 'm1'),
        height: 1100,
        me: _me(role: 'operator', pedidos: const {'ver': true, 'editar': true}),
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
      );
      await openMenu(tester);
      expect(find.text('Editar venta'), findsOneWidget);
      expect(find.text('Eliminar venta'), findsNothing);
    });

    testWidgets('solo lectura: ni editar ni eliminar', (tester) async {
      await _open(
        tester,
        const SaleDetailScreen(source: 'manual', id: 'm1'),
        height: 1100,
        me: _me(role: 'operator', pedidos: const {'ver': true}),
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
      );
      await openMenu(tester);
      expect(find.text('Editar venta'), findsNothing);
      expect(find.text('Eliminar venta'), findsNothing);
      expect(find.text('Ver comprobante'), findsOneWidget);
    });

    testWidgets('eliminar pide confirmación, borra y vuelve', (tester) async {
      final api = _FakeApi();
      await _open(
        tester,
        const SaleDetailScreen(source: 'manual', id: 'm1'),
        api: api,
        height: 1100,
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
      );
      await openMenu(tester);
      await tester.tap(find.text('Eliminar venta'));
      await _settle(tester, 4);
      expect(find.text('¿Eliminar la venta de Cliente de feria?'), findsOneWidget);
      expect(find.text('No se puede deshacer.'), findsOneWidget);
      _noOverflow(tester, 'borrar_dialogo');
      await _shot(tester, 'ventas_extra_borrar');

      // Cancelar no borra nada (hay otro "Cancelar" detrás: el del pedido).
      await tester.tap(find.descendant(of: find.byType(AlertDialog), matching: find.text('Cancelar')));
      await _settle(tester, 4);
      expect(api.deletedManual, isNull);

      await openMenu(tester);
      await tester.tap(find.text('Eliminar venta'));
      await _settle(tester, 4);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await _settle(tester);
      expect(api.deletedManual, 'm1');
      expect(find.text('Detalle'), findsNothing, reason: 'volvió a la pantalla anterior');
      expect(find.text('Venta eliminada'), findsOneWidget);
    });

    testWidgets('eliminar un pedido online llama al endpoint de pedidos', (tester) async {
      final api = _FakeApi();
      await _open(
        tester,
        const SaleDetailScreen(source: 'online', id: 'o1'),
        api: api,
        height: 1700,
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _onlineDetail)],
      );
      await openMenu(tester);
      await tester.tap(find.text('Eliminar pedido'));
      await _settle(tester, 4);
      expect(find.text('¿Eliminar el pedido HF-0042?'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await _settle(tester);
      expect(api.deletedOrder, 'o1');
      expect(api.deletedManual, isNull);
    });

    testWidgets('si el servidor rechaza el borrado, el motivo se ve en el diálogo', (tester) async {
      final api = _FakeApi()
        ..failWith = ApiException('forbidden', 'Eliminar ventas es solo para administradores.', status: 403);
      await _open(
        tester,
        const SaleDetailScreen(source: 'manual', id: 'm1'),
        api: api,
        height: 1100,
        overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
      );
      await openMenu(tester);
      await tester.tap(find.text('Eliminar venta'));
      await _settle(tester, 4);
      await tester.tap(find.widgetWithText(FilledButton, 'Eliminar'));
      await _settle(tester);
      expect(find.text('Eliminar ventas es solo para administradores.'), findsOneWidget);
      expect(find.text('¿Eliminar la venta de Cliente de feria?'), findsOneWidget, reason: 'el diálogo sigue abierto');
    });
  });

  group('Listado de ventas', () {
    testWidgets('con permiso de crear aparece "Nueva venta" y abre el formulario', (tester) async {
      await _open(
        tester,
        const AdminSalesScreen(),
        push: false,
        overrides: [adminSalesProvider.overrideWith((ref, f) async => _sales)],
      );
      expect(find.text('Nueva venta'), findsOneWidget);
      _noOverflow(tester, 'ventas_con_boton');
      await _shot(tester, 'ventas_extra_listado');
      await tester.tap(find.text('Nueva venta'));
      await _settle(tester);
      expect(find.text('Registrar venta'), findsOneWidget);
    });

    testWidgets('sin permiso de crear no hay botón', (tester) async {
      await _open(
        tester,
        const AdminSalesScreen(),
        push: false,
        me: _me(role: 'operator', pedidos: const {'ver': true, 'editar': true}),
        overrides: [adminSalesProvider.overrideWith((ref, f) async => _sales)],
      );
      expect(find.text('Nueva venta'), findsNothing);
      expect(find.text('1 venta'), findsOneWidget);
    });
  });
}
