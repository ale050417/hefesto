import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/calculadora/calc_logic.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';
import 'package:hefesto/features/admin/calculadora/filament_choices.dart';
import 'package:hefesto/features/admin/calculadora/new_preset_dialog.dart';

Map<String, dynamic> _filament(String id, String color, num cost) =>
    {'id': id, 'material': 'PLA', 'color': color, 'brand': 'Grilon3', 'costPerKg': cost, 'hex': '#CC2200'};

Map<String, dynamic> _config() => {
      'kwhPrice': 95,
      'machineWatts': 220,
      'machineLifeHours': 8000,
      'maintenanceCost': 320000,
      'marginErrorPct': 8,
    };

/// `GET /api/v1/admin/calculadora` como lo ve el ADMIN.
Map<String, dynamic> _adminJson() => {
      'isAdmin': true,
      'config': _config(),
      'filaments': [_filament('f1', 'Rojo', 25000), _filament('f2', 'Dorado', 35000)],
      'presetOptions': [
        {'id': 'p1', 'name': 'Llaveros'},
      ],
      'presets': [
        {'id': 'p1', 'name': 'Llaveros', 'marginPct': 150, 'active': true, 'sortOrder': 0},
        {'id': 'p2', 'name': 'Viejo', 'marginPct': '80.00', 'active': false, 'sortOrder': 1},
      ],
      'history': [
        {
          'id': 'h1',
          'name': 'Soporte auriculares',
          'customer': 'Juan',
          'material': 'PLA',
          'color': 'Rojo',
          'grams': 120,
          'hours': 3.5,
          'precioFinal': 3086.25,
          'notes': null,
          'createdAt': '2026-10-30T10:00:00.000Z',
          'costPerKg': 25000,
          'marginPct': 150,
          'costoTotal': 1234.5,
          'ganancia': 1851.75,
        },
      ],
      'stats': {'count': 1, 'grams': 120, 'hours': 3.5, 'ganancia': 1851.75, 'precioFinal': 3086.25},
    };

/// El mismo endpoint como lo ve el OPERADOR: sin margen, costo ni ganancia.
Map<String, dynamic> _operatorJson() => {
      'isAdmin': false,
      'config': _config(),
      'filaments': [_filament('f1', 'Rojo', 25000)],
      'presetOptions': [
        {'id': 'p1', 'name': 'Llaveros'},
      ],
      'presets': <dynamic>[],
      'history': [
        {
          'id': 'h1',
          'name': 'Soporte',
          'customer': null,
          'material': 'PLA',
          'color': null,
          'grams': '120.00',
          'hours': '3.50',
          'precioFinal': '3086.25',
          'notes': null,
          'createdAt': '2026-10-30T10:00:00.000Z',
        },
      ],
      'stats': {'count': 1, 'grams': 120, 'hours': 3.5},
    };

CalcHistoryItem _item(String name, {String? customer, double price = 100, String date = '2026-10-01T10:00:00Z'}) =>
    CalcHistoryItem.fromJson({'id': name, 'name': name, 'customer': customer, 'precioFinal': price, 'createdAt': date});

void main() {
  group('CalcOverview.fromJson', () {
    test('admin: tipos con margen y costos del historial', () {
      final o = CalcOverview.fromJson(_adminJson());
      expect(o.isAdmin, isTrue);
      expect(o.config.marginErrorPct, 8);
      expect(o.filaments.map((f) => f.costPerKg), [25000, 35000]);
      expect(o.filaments.first.label, 'PLA · Rojo · Grilon3');
      expect(o.filaments.first.hex, '#CC2200');
      expect(o.presets.map((p) => p.marginPct), [150, 80]);
      expect(o.presets[1].active, isFalse);
      expect(o.presetOptions.single.marginPct, isNull);
      final h = o.history.single;
      expect(h.hasCosts, isTrue);
      expect(h.ganancia, 1851.75);
      expect(h.materialLabel, 'PLA · Rojo');
      expect(o.stats.ganancia, 1851.75);
      expect(o.stats.precioFinal, 3086.25);
    });

    test('operador: nada que revele margen ni ganancia', () {
      final o = CalcOverview.fromJson(_operatorJson());
      expect(o.isAdmin, isFalse);
      expect(o.presets, isEmpty);
      expect(o.presetOptions.single.name, 'Llaveros');
      final h = o.history.single;
      expect(h.hasCosts, isFalse);
      expect(h.marginPct, isNull);
      expect(h.ganancia, isNull);
      expect(h.grams, 120, reason: 'numeric como String');
      expect(h.precioFinal, 3086.25);
      expect(h.materialLabel, 'PLA');
      expect(o.stats.ganancia, isNull);
      expect(o.stats.precioFinal, isNull);
    });

    test('un JSON vacío no rompe', () {
      final o = CalcOverview.fromJson({});
      expect(o.isAdmin, isFalse);
      expect(o.filaments, isEmpty);
      expect(o.history, isEmpty);
      expect(o.config.machineLifeHours, 1);
      expect(o.stats.count, 0);
    });
  });

  group('CalcQuote.fromJson', () {
    test('admin: desglose completo', () {
      final q = CalcQuote.fromJson({
        'detail': true,
        'material': 2500,
        'electricidad': 12.35,
        'desgaste': 8.5,
        'subtotal': 2520.85,
        'margenError': 201.67,
        'costoTotal': 2722.52,
        'ganancia': 4083.78,
        'precioFinal': 6806.3,
        'hours': 3.5,
        'marginPct': 150,
        'costPerKg': 25000,
      });
      expect(q.detail, isTrue);
      expect(q.precioFinal, 6806.3);
      expect(q.costoTotal, 2722.52);
      expect(q.marginPct, 150);
    });

    test('operador: solo el precio final', () {
      final q = CalcQuote.fromJson({'detail': false, 'precioFinal': 6806.3});
      expect(q.detail, isFalse);
      expect(q.precioFinal, 6806.3);
      expect(q.costoTotal, 0);
      expect(q.ganancia, 0);
    });
  });

  test('QuoteRequest manda solo ids y números (el costo y el margen son del servidor)', () {
    const r = QuoteRequest(presetId: 'p1', filamentId: 'f1', grams: 120.5, hours: 3.5);
    expect(r.toJson(), {'presetId': 'p1', 'filamentId': 'f1', 'grams': 120.5, 'hours': 3.5});
  });

  test('CalcConfig: toJson e igualdad por valor', () {
    final c = CalcConfig.fromJson(_config());
    expect(c.toJson()['marginErrorPct'], 8);
    expect(c, CalcConfig.fromJson(_config()));
    final other = CalcConfig.fromJson({..._config(), 'kwhPrice': 100});
    expect(c == other, isFalse);
  });

  group('lógica del formulario', () {
    test('horas + minutos', () {
      expect(totalHours(3, 30), 3.5);
      expect(totalHours(null, 45), 0.75);
      expect(totalHours(2, null), 2);
      expect(totalHours(null, null), 0);
    });

    test('hay algo para cotizar si hay gramos u horas', () {
      expect(hasQuoteData(120, 0), isTrue);
      expect(hasQuoteData(0, 1.5), isTrue);
      expect(hasQuoteData(0, 0), isFalse);
      expect(hasQuoteData(null, 0), isFalse);
    });

    test('duración legible', () {
      expect(formatDuration(3.5), '3 h 30 min');
      expect(formatDuration(0.75), '45 min');
      expect(formatDuration(2), '2 h');
      expect(formatDuration(0), '0 min');
    });
  });

  group('historial: buscar y ordenar', () {
    final items = [
      _item('Soporte', customer: 'Juan', price: 3000, date: '2026-10-02T10:00:00Z'),
      _item('Llavero', customer: 'Ana', price: 500, date: '2026-10-05T10:00:00Z'),
      _item('Maceta', price: 9000, date: '2026-10-01T10:00:00Z'),
    ];

    test('más recientes primero', () {
      expect(filterHistory(items).map((e) => e.name), ['Llavero', 'Soporte', 'Maceta']);
    });

    test('mayor precio', () {
      expect(filterHistory(items, sort: HistorySort.price).map((e) => e.name), ['Maceta', 'Soporte', 'Llavero']);
    });

    test('por nombre', () {
      expect(filterHistory(items, sort: HistorySort.name).map((e) => e.name), ['Llavero', 'Maceta', 'Soporte']);
    });

    test('busca en nombre y cliente sin importar mayúsculas', () {
      expect(filterHistory(items, query: 'sop').map((e) => e.name), ['Soporte']);
      expect(filterHistory(items, query: 'ANA').map((e) => e.name), ['Llavero']);
      expect(filterHistory(items, query: 'xyz'), isEmpty);
      expect(filterHistory(items, query: '  ').length, 3);
    });
  });
  group('filamentos agrupados por tipo (filament_choices)', () {
    CalcFilament f(String id, String color, String? typeId, String? typeName, [double cost = 26000]) => CalcFilament(
          id: id,
          material: 'PLA',
          color: color,
          brand: 'Bambu Lab',
          costPerKg: cost,
          typeId: typeId,
          typeName: typeName,
        );
    // Los mismos casos que `filament-choices.test.ts` de la web.
    final list = [
      f('a', 'Verde', 't-pla', 'PLA'),
      f('b', 'Azul', 't-pla', 'PLA'),
      f('c', 'Dorado', 't-silk', 'PLA Silk (Dorado)', 34000),
      f('d', 'Negro', null, null, 18000),
      f('e', 'Negro', 't-petg', 'PETG'),
    ];

    test('el JSON de un filamento trae typeId y typeName (o null)', () {
      final con = CalcFilament.fromJson({'id': 'a', 'material': 'PLA', 'costPerKg': 26000, 'typeId': 't-pla', 'typeName': 'PLA'});
      expect(con.typeId, 't-pla');
      expect(con.typeName, 'PLA');
      final sin = CalcFilament.fromJson({'id': 'd', 'material': 'PLA', 'costPerKg': 18000, 'typeId': null, 'typeName': null});
      expect(sin.typeId, isNull);
      expect(sin.typeName, isNull);
      expect(CalcFilament.fromJson({'id': 'x'}).typeId, isNull, reason: 'servidor viejo: sin el campo');
    });

    test('junta los carretes del mismo tipo en una sola opción, en orden alfabético', () {
      final c = filamentChoices(list);
      expect(c.grouped, isTrue);
      expect([for (final t in c.types) (t.name, t.costPerKg, t.spools)], [
        ('PETG', 26000.0, 1),
        ('PLA', 26000.0, 2),
        ('PLA Silk (Dorado)', 34000.0, 1),
      ]);
      expect([for (final x in c.loose) x.id], ['d']);
    });

    test('cada tipo viaja con el id de uno de sus carretes', () {
      final pla = filamentChoices(list).types.firstWhere((t) => t.typeId == 't-pla');
      expect(pla.value, 'a');
    });

    test('sin tipos cargados, todos los carretes quedan sueltos (la lista de siempre)', () {
      final plain = [f('a', 'Verde', null, null), f('b', 'Azul', null, null)];
      final c = filamentChoices(plain);
      expect(c.grouped, isFalse);
      expect(c.types, isEmpty);
      expect(c.loose, plain);
    });

    test('si falta el nombre del tipo se usa el material', () {
      expect(filamentChoices([f('a', 'Verde', 't1', null)]).types.single.name, 'PLA');
    });

    test('el orden no distingue mayúsculas ni tildes', () {
      final c = filamentChoices([
        f('1', 'x', 't1', 'petg'),
        f('2', 'x', 't2', 'ÁBS'),
        f('3', 'x', 't3', 'Nylon'),
      ]);
      expect([for (final t in c.types) t.name], ['ÁBS', 'Nylon', 'petg']);
    });

    test('choiceValueFor: un carrete con tipo cae en la opción de su tipo', () {
      expect(choiceValueFor(list, 'b'), 'a');
      expect(choiceValueFor(list, 'd'), 'd', reason: 'sin tipo se elige a sí mismo');
      expect(choiceValueFor(list, 'zzz'), isNull, reason: 'ya no existe');
      expect(choiceValueFor(list, null), isNull);
    });

    test('firstChoiceValue: el primer tipo; sin tipos, el primer carrete; sin nada, null', () {
      expect(firstChoiceValue(list), 'e');
      expect(firstChoiceValue([f('x', 'Rojo', null, null)]), 'x');
      expect(firstChoiceValue([]), isNull);
    });

    test('typeChoiceOf: el tipo de un carrete, o null si va suelto', () {
      expect(typeChoiceOf(list, 'b')!.name, 'PLA');
      expect(typeChoiceOf(list, 'b')!.spools, 2);
      expect(typeChoiceOf(list, 'd'), isNull);
      expect(typeChoiceOf(list, null), isNull);
    });
  });

  group('tipos de producto con el recién creado', () {
    const a = CalcPreset(id: 'p1', name: 'Llaveros');
    const nuevo = CalcPreset(id: 'p9', name: 'Mates');

    test('se agrega al final mientras el servidor todavía no lo trae', () {
      expect([for (final p in presetOptionsWith(const [a], nuevo)) p.id], ['p1', 'p9']);
    });

    test('no se repite cuando ya vino en la lista, y sin creado queda igual', () {
      expect(presetOptionsWith(const [a, nuevo], nuevo), hasLength(2));
      expect(presetOptionsWith(const [a], null), hasLength(1));
    });
  });
}
