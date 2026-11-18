import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/dashboard_screen.dart';
import 'package:hefesto/features/admin/sale_detail_screen.dart';
import 'package:hefesto/features/admin/sales_screen.dart';
import 'package:hefesto/features/admin/stock_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'support/sales_kit.dart';

/// Dibuja cada pantalla del panel con datos de ejemplo. Sirve de humo (si algo
/// se desborda o lanza, el test falla) y, con SHOT_DIR=ruta_de_una_carpeta, guarda una
/// captura PNG de cada una para revisarlas a ojo.
final _shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

final _me = MeInfo.fromJson({
  'id': 'u1',
  'email': 'ale@hefesto.com',
  'fullName': 'Ale',
  'role': 'admin',
  'isStaff': true,
  'permissions': {
    for (final m in ['pedidos', 'filamentos'])
      m: {'ver': true, 'crear': true, 'editar': true, 'eliminar': true},
  },
});

Map<String, dynamic> _filament(String id, String color, String hex, num stock, String status) => {
      'id': id,
      'material': 'PLA',
      'color': color,
      'brand': 'Grilon3',
      'diameter': '1.75',
      'stockGrams': stock,
      'spoolGrams': 1000,
      'costPerKg': 20000,
      'alertThresholdGrams': 200,
      'lowStock': status != 'ok',
      'status': status,
      'hex': hex,
    };

Map<String, dynamic> _order(String id, String n, String? who, String status, num total, String items, int daysAgo) => {
      'id': id,
      'orderNumber': n,
      'customerName': who,
      'paymentMethod': 'transfer',
      'total': total,
      'status': status,
      'createdAt': DateTime(2026, 10, 31).subtract(Duration(days: daysAgo)).toIso8601String(),
      'updatedAt': DateTime(2026, 10, 31).toIso8601String(),
      'itemsSummary': items,
    };

final _dashboard = AdminDashboard.fromJson({
  'greetingName': 'Ale',
  'kpis': {'revenue': 1250000, 'salesCount': 48, 'pendingCount': 3, 'lowStockCount': 2},
  'revenueSeries': [
    for (var i = 29; i >= 0; i--)
      {
        'date': DateTime(2026, 10, 31).subtract(Duration(days: i)).toIso8601String().substring(0, 10),
        'total': (i * 7919) % 5 == 0 ? 0 : 8000 + ((i * 7919) % 40) * 1500,
      },
  ],
  'last7': 98500,
  'last30': 612000,
  'counts': {'pendingPayment': 3, 'inProduction': 5, 'ready': 1},
  'statusCounts': <String, dynamic>{},
  'recentOrders': [
    _order('o1', 'HF-0042', 'Juan Pérez', 'in_production', 57500, 'Mate Mario · Cartel ×2', 1),
    _order('o2', 'HF-0041', null, 'pending_payment', 32500, 'Cartel Personalizado', 2),
    _order('o3', 'HF-0040', 'Ana Gómez', 'delivered', 110000, 'Tony Tony Chopper Tamaño Real', 4),
  ],
  'lowStock': [
    _filament('f1', 'Rojo', '#CC2200', 120, 'bajo'),
    _filament('f2', 'Negro', '#111111', 0, 'agotado'),
  ],
  'degraded': <String>[],
});

final _sales = SalesPage.fromJson({
  'total': 4,
  'items': [
    {'id': 'a', 'source': 'online', 'date': '2026-10-30T10:00:00.000Z', 'customerName': 'Juan Pérez', 'label': 'Mate Mario · Cartel ×2', 'ref': 'HF-0042', 'paymentMethod': 'mercadopago', 'status': 'in_production', 'total': 57500},
    {'id': 'b', 'source': 'manual', 'date': '2026-10-29T10:00:00.000Z', 'customerName': 'Cliente de feria con un nombre bastante largo para probar el recorte', 'label': '5 llaveros personalizados con nombre y color a elección', 'ref': null, 'paymentMethod': 'cash', 'status': 'delivered', 'total': 10000},
    {'id': 'c', 'source': 'online', 'date': '2026-10-28T10:00:00.000Z', 'customerName': null, 'label': '', 'ref': 'HF-0039', 'paymentMethod': 'transfer', 'status': 'pending_payment', 'total': 32500},
    {'id': 'd', 'source': 'online', 'date': '2026-10-27T10:00:00.000Z', 'customerName': 'Ana', 'label': 'Figura', 'ref': 'HF-0038', 'paymentMethod': 'cash', 'status': 'cancelled', 'total': 4500},
  ],
});

final _stock = StockPage.fromJson({
  'counts': {'total': 4, 'low': 1, 'out': 1},
  'items': [
    _filament('1', 'Blanco', '#F2F2F2', 840, 'ok'),
    _filament('2', 'Rojo', '#CC2200', 120, 'bajo'),
    _filament('3', 'Negro', '#111111', 0, 'agotado'),
    _filament('4', 'Verde militar', '#4B5320', 1000, 'ok'),
  ],
});

final _onlineDetail = SaleDetail.online({
  'id': 'o1',
  'orderNumber': 'HF-0042',
  'status': 'ready',
  'paymentMethod': 'mercadopago',
  'subtotal': 60000,
  'discountAmount': 5000,
  'shippingCost': 2500,
  'total': 57500,
  'shippingAddress': {
    'fullName': 'Juan Pérez',
    'phone': '+54 3757 624148',
    'street': 'Av. Siempreviva 742',
    'city': 'Posadas',
    'province': 'Misiones',
    'postalCode': '3300',
    'zone': 'Centro',
    'deliveryType': 'local',
    'notes': 'Dejar con el vecino si no estoy',
  },
  'trackingCode': null,
  'internalNote': 'Pidió que el rojo sea más oscuro',
  'cancelReason': null,
  'createdAt': '2026-10-30T15:00:00.000Z',
  'paidAt': '2026-10-30T15:05:00.000Z',
  'customer': {'fullName': 'Juan Pérez', 'phone': '+54 3757 624148'},
  'items': [
    {'id': 'i1', 'productName': 'Mate Mario', 'variantLabel': 'Rojo', 'unitPrice': 30000, 'quantity': 2, 'lineTotal': 60000},
  ],
  'history': [
    {'fromStatus': null, 'toStatus': 'pending_payment', 'note': null, 'createdAt': '2026-10-30T15:00:00.000Z'},
    {'fromStatus': 'pending_payment', 'toStatus': 'confirmed', 'note': 'Pago acreditado por MercadoPago', 'createdAt': '2026-10-30T15:05:00.000Z'},
    {'fromStatus': 'confirmed', 'toStatus': 'in_production', 'note': null, 'createdAt': '2026-10-30T18:00:00.000Z'},
    {'fromStatus': 'in_production', 'toStatus': 'ready', 'note': null, 'createdAt': '2026-10-31T09:00:00.000Z'},
  ],
});

final _manualDetail = SaleDetail.manual({
  'id': 'm1',
  'saleDate': '2026-10-29T12:00:00.000Z',
  'customerName': 'Cliente de feria',
  'detail': '5 llaveros',
  'category': 'Llaveros',
  'status': 'cancelled',
  'paymentMethod': 'cash',
  'quantity': 5,
  'total': 10000,
  'cancelReason': 'El cliente se arrepintió',
  'items': <dynamic>[],
});

Future<void> _show(
  WidgetTester tester,
  String name,
  Widget screen, {
  double height = 880,
  MeInfo? me,
  List<Override> overrides = const [],
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(392 * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        // Ventas arranca en el mes actual: "hoy" fijo en octubre de 2026.
        ...salesKitOverrides(),
        meProvider.overrideWith((ref) async => me ?? _me),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(HefestoThemeMode.dark),
          home: screen,
        ),
      ),
    ),
  );
  // Sin pumpAndSettle: los esqueletos animan para siempre.
  for (var i = 0; i < 6; i++) {
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
    if (_shotDir != null) Directory(_shotDir!).createSync(recursive: true);
    {
      // Siempre las tipografías de la marca: con la de reemplazo de los tests
      // (muy ancha) aparecen desbordes que en el teléfono no existen.
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
    }
  });

  testWidgets('Inicio del panel', (tester) async {
    await _show(
      tester,
      'dashboard',
      const AdminDashboardScreen(),
      height: 1900,
      overrides: [adminDashboardProvider.overrideWith((ref) async => _dashboard)],
    );
    expect(find.text('Hola, Ale'), findsOneWidget);
    expect(find.text('HF-0042'), findsOneWidget);
    expect(find.text('Por cobrar'), findsOneWidget);
  });

  testWidgets('Listado de ventas', (tester) async {
    await _show(
      tester,
      'ventas',
      const AdminSalesScreen(),
      overrides: [adminSalesProvider.overrideWith((ref, f) async => _sales)],
    );
    expect(find.text('4 ventas'), findsOneWidget);
    expect(find.text('Mostrador'), findsWidgets);
  });

  testWidgets('Detalle de un pedido online (con acciones)', (tester) async {
    await _show(
      tester,
      'detalle_online',
      const SaleDetailScreen(source: 'online', id: 'o1'),
      height: 2300,
      overrides: [adminSaleProvider.overrideWith((ref, k) async => _onlineDetail)],
    );
    expect(find.text('HF-0042'), findsWidgets);
    expect(find.text('Marcar enviado'), findsOneWidget);
    expect(find.text('Marcar entregado'), findsOneWidget);
    expect(find.text('Cancelar'), findsOneWidget, reason: 'admin ve cancelar');
    expect(find.text('Reembolsar'), findsOneWidget);
  });

  testWidgets('Detalle de una venta manual cancelada (sin acciones)', (tester) async {
    await _show(
      tester,
      'detalle_manual',
      const SaleDetailScreen(source: 'manual', id: 'm1'),
      height: 1300,
      overrides: [adminSaleProvider.overrideWith((ref, k) async => _manualDetail)],
    );
    expect(find.textContaining('El cliente se arrepintió'), findsOneWidget);
    expect(find.text('Marcar enviado'), findsNothing);
    expect(find.text('ACCIONES'), findsNothing);
  });

  testWidgets('Un operador NO ve cancelar ni reembolsar', (tester) async {
    final operator = MeInfo.fromJson({
      'id': 'u2',
      'role': 'operator',
      'isStaff': true,
      'permissions': {'pedidos': {'ver': true, 'editar': true}},
    });
    await _show(
      tester,
      'detalle_operador',
      const SaleDetailScreen(source: 'online', id: 'o1'),
      height: 2300,
      me: operator,
      overrides: [adminSaleProvider.overrideWith((ref, k) async => _onlineDetail)],
    );
    expect(find.text('Marcar enviado'), findsOneWidget);
    expect(find.text('Cancelar'), findsNothing);
    expect(find.text('Reembolsar'), findsNothing);
    expect(find.textContaining('solo para administradores'), findsOneWidget);
  });

  testWidgets('Stock de filamentos', (tester) async {
    await _show(
      tester,
      'stock',
      const AdminStockScreen(),
      height: 1100,
      overrides: [adminStockProvider.overrideWith((ref) async => _stock)],
    );
    expect(find.text('Agotado'), findsOneWidget);
    expect(find.text('Stock bajo'), findsWidgets);
  });

  testWidgets('Sin permiso de pedidos se muestra "Sin acceso"', (tester) async {
    final noPerm = MeInfo.fromJson({
      'id': 'u3',
      'role': 'operator',
      'isStaff': true,
      'permissions': {'pedidos': {'ver': false}},
    });
    await _show(
      tester,
      'sin_acceso',
      const AdminSalesScreen(),
      me: noPerm,
    );
    expect(find.text('Sin acceso'), findsOneWidget);
  });

  testWidgets('Un error del servidor se muestra con "Reintentar"', (tester) async {
    await _show(
      tester,
      'error',
      const AdminSalesScreen(),
      overrides: [adminSalesProvider.overrideWith((ref, f) => throw Exception('boom'))],
    );
    expect(find.text('Reintentar'), findsOneWidget);
  });
}
