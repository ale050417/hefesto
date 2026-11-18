import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart' show HefestoThemeMode;
import 'package:hefesto/core/widgets/common.dart' show GoldButton;
import 'package:hefesto/features/admin/produccion/produccion_api.dart';
import 'package:hefesto/features/admin/produccion/produccion_models.dart';
import 'package:hefesto/features/admin/produccion/produccion_screen.dart';
import 'package:hefesto/features/admin/sale_status.dart';

import 'admin_produccion_models_test.dart' show boardJson;
import 'support/produccion_fallas_filamentos_kit.dart';

/// API de mentira: anota los movimientos y no toca la red.
class FakeProduccionApi extends ProduccionApi {
  FakeProduccionApi() : super(ApiClient());

  final moves = <(String id, SaleStatus to)>[];
  final trackings = <(String id, String code)>[];
  Object? failWith;

  @override
  Future<void> move(BoardCard card, SaleStatus to) async {
    if (failWith != null) throw failWith!;
    moves.add((card.id, to));
  }

  @override
  Future<void> setTracking(String orderId, String code) async {
    trackings.add((orderId, code));
  }
}

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(setUpKit);

  final data = BoardData.fromJson(boardJson());
  final me = meWith({
    'produccion': ['ver'],
    'pedidos': ['ver', 'editar'],
  });

  group('cola', () {
    testWidgets('dibuja las tarjetas agrupadas por etapa', (tester) async {
      await showScreen(
        tester,
        'produccion',
        const AdminProduccionScreen(),
        height: 1500,
        me: me,
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      expect(find.descendant(of: find.byType(AppBar), matching: find.text('Cola')), findsOneWidget);
      expect(find.text('3 trabajos en curso'), findsOneWidget);
      expect(find.text('Mate Mario ×2 · Cartel'), findsOneWidget);
      expect(find.text('5 llaveros'), findsOneWidget);
      expect(find.text('1 demorado'), findsOneWidget);
      expect(find.text('hace 2 d'), findsOneWidget, reason: '50 h = 2 días');
      // Botón de la siguiente etapa de cada tarjeta.
      expect(find.text('Marcar listo'), findsOneWidget);
      expect(find.text('Confirmar pago'), findsOneWidget);
      expect(find.text('Marcar enviado'), findsOneWidget);
      expect(find.text('Marcar entregado'), findsOneWidget, reason: 'desde "listo" también se entrega');
    });

    testWidgets('sin overflow a 360 dp con fuente grande', (tester) async {
      await showScreen(
        tester,
        'produccion_fuente_grande',
        const AdminProduccionScreen(),
        width: 360,
        height: 2200,
        textScale: 1.4,
        me: me,
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Mate Mario ×2 · Cartel'), findsOneWidget);
    });

    testWidgets('filtrar por etapa muestra solo esas tarjetas', (tester) async {
      await showScreen(
        tester,
        'produccion_etapa',
        const AdminProduccionScreen(),
        height: 1000,
        me: me,
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      await tester.ensureVisible(find.text('En producción (1)'));
      await tester.pump();
      await tester.tap(find.text('En producción (1)'));
      await settle(tester);
      expect(find.text('Mate Mario ×2 · Cartel'), findsOneWidget);
      expect(find.text('5 llaveros'), findsNothing);
    });

    testWidgets('filtrar por tipo: solo mostrador', (tester) async {
      await showScreen(
        tester,
        'produccion_tipo',
        const AdminProduccionScreen(),
        height: 1000,
        me: me,
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      await tester.tap(find.text('Mostrador').first);
      await settle(tester);
      expect(find.text('5 llaveros'), findsOneWidget);
      expect(find.text('Figura'), findsNothing);
    });

    testWidgets('sin trabajos muestra el estado vacío', (tester) async {
      await showScreen(
        tester,
        'produccion_vacio',
        const AdminProduccionScreen(),
        me: me,
        overrides: [produccionProvider.overrideWith((ref) async => BoardData.fromJson({}))],
      );
      expect(find.text('No hay trabajos en la cola'), findsOneWidget);
    });

    testWidgets('sin permiso de editar pedidos no hay botones de avance', (tester) async {
      await showScreen(
        tester,
        'produccion_solo_ver',
        const AdminProduccionScreen(),
        height: 1300,
        me: meWith({'produccion': ['ver']}, role: 'operator'),
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('5 llaveros'), findsOneWidget);
      expect(find.text('Marcar listo'), findsNothing);
      expect(find.textContaining('no avanzar'), findsOneWidget);
    });

    testWidgets('sin permiso de ver muestra "Sin acceso"', (tester) async {
      await showScreen(
        tester,
        'produccion_sin_acceso',
        const AdminProduccionScreen(),
        me: meWith({'produccion': <String>[]}, role: 'operator'),
        overrides: [produccionProvider.overrideWith((ref) async => data)],
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra con "Reintentar"', (tester) async {
      await showScreen(
        tester,
        'produccion_error',
        const AdminProduccionScreen(),
        me: me,
        overrides: [produccionProvider.overrideWith((ref) => throw Exception('boom'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
    });

    testWidgets('avisa cuando una fuente no se pudo cargar', (tester) async {
      await showScreen(
        tester,
        'produccion_degradada',
        const AdminProduccionScreen(),
        height: 1300,
        me: me,
        overrides: [
          produccionProvider.overrideWith(
            (ref) async => BoardData.fromJson({...boardJson(), 'degraded': ['ventas manuales']}),
          ),
        ],
      );
      expect(find.textContaining('No pudimos cargar ventas manuales'), findsOneWidget);
    });
  });

  group('avanzar un trabajo', () {
    testWidgets('confirma y manda el cambio de etapa al servidor', (tester) async {
      final api = FakeProduccionApi();
      await showScreen(
        tester,
        'produccion_mover',
        const AdminProduccionScreen(),
        height: 1500,
        me: me,
        overrides: [
          produccionProvider.overrideWith((ref) async => data),
          produccionApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Marcar listo'));
      await settle(tester);
      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.textContaining('Le avisamos al cliente'), findsOneWidget);

      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar'));
      await settle(tester);

      expect(api.moves, [('o1', SaleStatus.ready)]);
      expect(api.trackings, isEmpty);
      expect(find.textContaining('Mate Mario ×2 · Cartel: Listo para entregar'), findsOneWidget);
    });

    testWidgets('confirmar el pago de una venta manual avisa que descuenta stock', (tester) async {
      final api = FakeProduccionApi();
      await showScreen(
        tester,
        'produccion_confirmar_pago',
        const AdminProduccionScreen(),
        height: 1500,
        me: me,
        overrides: [
          produccionProvider.overrideWith((ref) async => data),
          produccionApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Confirmar pago'));
      await settle(tester);
      expect(find.textContaining('se descuenta el filamento'), findsOneWidget);
      // Es una venta manual: no hay aviso al cliente.
      expect(find.textContaining('Le avisamos al cliente'), findsNothing);
    });

    testWidgets('marcar enviado un pedido online pide el código de seguimiento', (tester) async {
      final api = FakeProduccionApi();
      await showScreen(
        tester,
        'produccion_enviar',
        const AdminProduccionScreen(),
        height: 1500,
        me: me,
        overrides: [
          produccionProvider.overrideWith((ref) async => data),
          produccionApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Marcar enviado'));
      await settle(tester);
      expect(find.text('Código de seguimiento'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Código de seguimiento'), 'ab123');
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar'));
      await settle(tester);

      expect(api.trackings, [('o2', 'ab123')], reason: 'el código se carga antes de cambiar el estado');
      expect(api.moves, [('o2', SaleStatus.shipped)]);
    });

    testWidgets('el rechazo del servidor se muestra en la hoja y no se cierra', (tester) async {
      final api = FakeProduccionApi()
        ..failWith = ApiException('invalid', 'Cargá el código de seguimiento antes de marcar el pedido como enviado.');
      await showScreen(
        tester,
        'produccion_error_mover',
        const AdminProduccionScreen(),
        height: 1500,
        me: me,
        overrides: [
          produccionProvider.overrideWith((ref) async => data),
          produccionApiProvider.overrideWithValue(api),
        ],
      );
      await tester.tap(find.text('Marcar enviado'));
      await settle(tester);
      await tester.tap(find.widgetWithText(GoldButton, 'Confirmar'));
      await settle(tester);
      expect(find.textContaining('Cargá el código de seguimiento'), findsOneWidget);
      expect(find.byType(MoveSheet), findsOneWidget);
      expect(api.moves, isEmpty);
    });
  });

  // Los tres temas de la app (oscuro, claro y luz nocturna), en un celular chico.
  group('temas', () {
    for (final mode in HefestoThemeMode.values) {
      testWidgets('cola en ${mode.name}', (tester) async {
        await showScreen(
          tester,
          'produccion_${mode.name}_360',
          const AdminProduccionScreen(),
          width: 360,
          height: 1400,
          mode: mode,
          me: me,
          overrides: [produccionProvider.overrideWith((ref) async => data)],
        );
        expect(find.text('Mate Mario ×2 · Cartel'), findsOneWidget);
      });
    }
  });
}
