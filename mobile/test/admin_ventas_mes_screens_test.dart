import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/admin_models.dart';
import 'package:hefesto/features/admin/admin_providers.dart';
import 'package:hefesto/features/admin/admin_widgets.dart';
import 'package:hefesto/features/admin/sales_screen.dart';

import 'support/produccion_fallas_filamentos_kit.dart';
import 'support/sales_kit.dart';

Map<String, dynamic> _row(String id, String date, String status, {String who = 'Cliente', String source = 'online'}) => {
      'id': id,
      'source': source,
      'date': date,
      'customerName': '$who $id',
      'label': 'Producto $id',
      'ref': source == 'manual' ? null : 'HF-$id',
      'paymentMethod': 'transfer',
      'status': status,
      'total': 1000,
    };

final _rows = [
  _row('n', '2026-11-01T01:30:00.000Z', 'confirmed'), // 31/10 22:30 en Argentina
  _row('a', '2026-10-30T15:00:00.000Z', 'in_production'),
  _row('b', '2026-10-29T15:00:00.000Z', 'delivered', source: 'manual'),
  _row('c', '2026-10-28T15:00:00.000Z', 'cancelled'),
  _row('s1', '2026-09-12T15:00:00.000Z', 'in_production'),
  _row('s2', '2026-09-03T15:00:00.000Z', 'delivered'),
  _row('g', '2026-08-05T15:00:00.000Z', 'pending_payment'),
];

Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(setUpKit);

  final me = meWith({'pedidos': allActions});

  /// Pedidos que se le hicieron al "servidor" (un registro por filtro).
  late List<SalesFilter> asked;

  Future<void> open(
    WidgetTester tester,
    String name, {
    List<Map<String, dynamic>>? rows,
    int? total,
    String? initialStatus,
    DateTime? now,
    SalesPage Function(SalesFilter f)? server,
  }) async {
    asked = [];
    final list = rows ?? _rows;
    await showScreen(
      tester,
      name,
      AdminSalesScreen(initialStatus: initialStatus),
      height: 1500,
      me: me,
      overrides: [
        adminSalesProvider.overrideWith((ref, f) async {
          asked.add(f);
          if (server != null) return server(f);
          return SalesPage.fromJson({'total': total ?? list.length, 'items': list});
        }),
        ...salesKitOverrides(now: now),
      ],
    );
  }

  bool selected(WidgetTester tester, String label) =>
      tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, label)).selected;

  testWidgets('arranca en el mes actual (hora de Argentina), con los contadores de ese mes', (tester) async {
    await open(tester, 'ventas_mes');
    expect(selected(tester, 'Octubre 2026'), isTrue);
    expect(selected(tester, 'Todos los meses'), isFalse);
    // La del 31 a las 22:30 de Argentina cuenta en octubre.
    expect(find.text('4 ventas'), findsOneWidget);
    expect(find.text('HF-n'), findsOneWidget);
    expect(find.text('HF-s1'), findsNothing);
    for (final chip in [
      'Todos (4)',
      'Sin cerrar (2)',
      'Pendiente de pago (0)',
      'Pago confirmado (1)',
      'En producción (1)',
      'Entregado (1)',
      'Cancelado (1)',
    ]) {
      expect(find.widgetWithText(ChoiceChip, chip), findsOneWidget, reason: 'falta el chip $chip');
    }
    expect(selected(tester, 'Todos (4)'), isTrue);
    // Al servidor se le pidió una sola vez y SIN estado ni mes (no sabe de meses).
    expect(asked, [(type: 'all', status: null, q: '')]);
  });

  testWidgets('el "hoy" manda: a la 1 de la mañana UTC del día 1 todavía es el mes anterior', (tester) async {
    await open(tester, 'ventas_mes_borde', now: DateTime.utc(2026, 11, 1, 1));
    expect(selected(tester, 'Octubre 2026'), isTrue);
    await open(tester, 'ventas_mes_borde_2', now: DateTime.utc(2026, 11, 1, 4));
    expect(selected(tester, 'Noviembre 2026'), isTrue);
  });

  testWidgets('flechas: mes anterior y siguiente, y "Volver a…" al mes actual', (tester) async {
    await open(tester, 'ventas_mes_flechas');
    expect(find.textContaining('Volver a'), findsNothing);
    await tester.tap(find.byTooltip('Mes anterior'));
    await settle(tester);
    expect(selected(tester, 'Septiembre 2026'), isTrue);
    expect(find.text('2 ventas'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Todos (2)'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'En producción (1)'), findsOneWidget);
    expect(find.text('Volver a octubre 2026'), findsOneWidget);

    await tester.tap(find.byTooltip('Mes anterior'));
    await settle(tester);
    expect(selected(tester, 'Agosto 2026'), isTrue);
    expect(find.text('1 venta'), findsOneWidget);

    // Está al final de la fila del mes (se desplaza de costado).
    await tester.ensureVisible(find.text('Volver a octubre 2026'));
    await tester.pump();
    await tester.tap(find.text('Volver a octubre 2026'));
    await settle(tester);
    expect(selected(tester, 'Octubre 2026'), isTrue);

    await tester.ensureVisible(find.byTooltip('Mes siguiente'));
    await tester.pump();
    await tester.tap(find.byTooltip('Mes siguiente'));
    await settle(tester);
    expect(selected(tester, 'Noviembre 2026'), isTrue);
    expect(find.text('No hay ventas en noviembre 2026'), findsOneWidget);
    expect(find.text('Mirá otro mes con las flechas, o tocá "Todos los meses".'), findsOneWidget);
    // Cambiar de mes no vuelve a pedirle nada al servidor.
    expect(asked, hasLength(1));
  });

  testWidgets('"Todos los meses" muestra todo; tocar el mes vuelve al actual; las flechas salen desde el actual',
      (tester) async {
    await open(tester, 'ventas_mes_todos');
    await tester.tap(find.widgetWithText(ChoiceChip, 'Todos los meses'));
    await settle(tester);
    expect(selected(tester, 'Todos los meses'), isTrue);
    expect(selected(tester, 'Octubre 2026'), isFalse);
    expect(find.text('7 ventas'), findsOneWidget);
    expect(find.widgetWithText(ChoiceChip, 'Sin cerrar (4)'), findsOneWidget);
    expect(find.textContaining('meses anteriores'), findsNothing);

    await tester.tap(find.byTooltip('Mes anterior'));
    await settle(tester);
    expect(selected(tester, 'Septiembre 2026'), isTrue);

    await tester.tap(find.widgetWithText(ChoiceChip, 'Todos los meses'));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('ventas-mes')));
    await settle(tester);
    expect(selected(tester, 'Octubre 2026'), isTrue);
  });

  testWidgets('aviso de meses anteriores sin cerrar: "Ver" pasa a todos los meses + sin cerrar', (tester) async {
    await open(tester, 'ventas_mes_atrasadas');
    expect(find.text('Hay 2 pedidos de meses anteriores sin cerrar'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Ver'));
    await settle(tester);
    expect(selected(tester, 'Todos los meses'), isTrue);
    expect(selected(tester, 'Sin cerrar (4)'), isTrue);
    expect(find.text('4 ventas'), findsOneWidget);
    expect(find.byType(SaleTile), findsNWidgets(4));
    expect(find.text('HF-g'), findsOneWidget);
    expect(find.text('HF-s2'), findsNothing, reason: 'la entregada no es "sin cerrar"');
    expect(find.textContaining('meses anteriores'), findsNothing);
  });

  testWidgets('una sola atrasada va en singular; sin atrasadas no hay aviso', (tester) async {
    await open(tester, 'ventas_mes_una_atrasada', rows: _rows.where((r) => r['id'] != 'g').toList());
    expect(find.text('Hay 1 pedido de meses anteriores sin cerrar'), findsOneWidget);
    await open(tester, 'ventas_mes_sin_atrasadas', rows: _rows.take(4).toList());
    expect(find.textContaining('meses anteriores'), findsNothing);
  });

  testWidgets('estado dentro del mes: filtra la lista y se puede destildar', (tester) async {
    await open(tester, 'ventas_mes_estado');
    await tester.tap(find.widgetWithText(ChoiceChip, 'Sin cerrar (2)'));
    await settle(tester);
    expect(find.text('2 ventas'), findsOneWidget);
    expect(find.text('HF-c'), findsNothing);
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Cancelado (1)'));
    await tester.tap(find.widgetWithText(ChoiceChip, 'Cancelado (1)'));
    await settle(tester);
    expect(find.text('1 venta'), findsOneWidget);
    expect(find.text('HF-c'), findsOneWidget);
    // Los contadores no cambian con el estado elegido.
    expect(find.widgetWithText(ChoiceChip, 'Todos (4)'), findsOneWidget);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Cancelado (1)'));
    await settle(tester);
    expect(selected(tester, 'Todos (4)'), isTrue);
    expect(asked, hasLength(1), reason: 'con todas las ventas cargadas, el estado se filtra en el teléfono');
  });

  testWidgets('un estado sin ventas en el mes: aviso de quitar filtros', (tester) async {
    await open(tester, 'ventas_mes_estado_vacio');
    await tester.tap(find.widgetWithText(ChoiceChip, 'Pendiente de pago (0)'));
    await settle(tester);
    expect(find.text('No hay ventas en octubre 2026'), findsOneWidget);
    expect(find.text('Probá quitando algún filtro o cambiando la búsqueda.'), findsOneWidget);
  });

  testWidgets('el tipo y la búsqueda sí van al servidor', (tester) async {
    await open(tester, 'ventas_mes_tipo');
    await tester.tap(find.widgetWithText(ChoiceChip, 'Mostrador'));
    await settle(tester);
    expect(asked.last, (type: 'manual', status: null, q: ''));
    await tester.enterText(find.byType(TextField), 'llavero');
    await settle(tester);
    expect(asked.last, (type: 'manual', status: null, q: 'llavero'));
  });

  testWidgets('al buscar, avisa las coincidencias de otros meses y las ofrece', (tester) async {
    await open(tester, 'ventas_mes_buscar');
    await tester.enterText(find.byType(TextField), 'cliente');
    await settle(tester);
    expect(find.text('+3 en otros meses · Ver'), findsOneWidget);
    await tester.tap(find.text('+3 en otros meses · Ver'));
    await settle(tester);
    expect(selected(tester, 'Todos los meses'), isTrue);
    expect(find.text('7 ventas'), findsOneWidget);
  });

  testWidgets('desde un atajo del inicio: el estado elegido y TODOS los meses', (tester) async {
    await open(tester, 'ventas_mes_atajo', initialStatus: 'in_production');
    expect(selected(tester, 'Todos los meses'), isTrue);
    expect(selected(tester, 'En producción (2)'), isTrue);
    expect(find.text('2 ventas'), findsOneWidget);
    expect(find.text('HF-s1'), findsOneWidget);
  });

  testWidgets('más ventas de las que llegan: se avisa y UN estado se le pide al servidor', (tester) async {
    // El servidor devuelve las 4 más nuevas de 9; con estado, las de ese estado.
    final old = _row('viejo', '2026-10-02T15:00:00.000Z', 'cancelled');
    await open(
      tester,
      'ventas_mes_truncado',
      server: (f) => f.status == null
          ? SalesPage.fromJson({'total': 9, 'items': _rows.take(4).toList()})
          : SalesPage.fromJson({
              'total': 2,
              'items': [_rows[3], old],
            }),
    );
    expect(find.textContaining('Hay 9 ventas y se cargaron las 4 más nuevas'), findsOneWidget);
    expect(asked, hasLength(1));
    await tester.ensureVisible(find.widgetWithText(ChoiceChip, 'Cancelado (1)'));
    await tester.tap(find.widgetWithText(ChoiceChip, 'Cancelado (1)'));
    await settle(tester);
    expect(asked.last, (type: 'all', status: 'cancelled', q: ''));
    // Aparece también la vieja, que no venía entre las más nuevas.
    expect(find.text('2 ventas'), findsOneWidget);
    expect(find.text('HF-viejo'), findsOneWidget);
  });
}
