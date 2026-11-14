import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/filamentos/filamento_form_screen.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_format.dart';
import 'package:hefesto/features/admin/filamentos/filamentos_models.dart';
import 'package:hefesto/features/admin/filamentos/parse_util.dart';
import 'package:hefesto/features/admin/filamentos/stock_adjust_sheet.dart';

void main() {
  group('Filamento.fromJson', () {
    test('lee la respuesta de GET /admin/filaments/:id (numeric como String)', () {
      final f = Filamento.fromJson({
        'id': 'f1',
        'material': 'PLA',
        'color': 'Rojo',
        'brand': 'Grilon3',
        'diameter': '1.75',
        'stockGrams': 840,
        'spoolGrams': '1000.00',
        'costPerKg': '20000.00',
        'alertThresholdGrams': 200,
        'lowStock': false,
        'status': 'ok',
        'hex': '#CC2200',
      });
      expect(f.stockGrams, 840);
      expect(f.spoolGrams, 1000);
      expect(f.costPerKg, 20000);
      expect(f.tag, 'PLA · Rojo · Grilon3');
      expect(f.stockValue, closeTo(16800, 0.001));
      expect(f.isOut, isFalse);
      expect(f.isLow, isFalse);
    });

    test('un stock negativo es deuda y no suma valor', () {
      final f = Filamento.fromJson({
        'id': 'f2',
        'material': 'PETG',
        'color': 'Negro',
        'stockGrams': -30,
        'costPerKg': 25000,
        'status': 'agotado',
      });
      expect(f.debtGrams, 30);
      expect(f.stockValue, 0);
      expect(f.isOut, isTrue);
      expect(f.brand, '');
      expect(f.tag, 'PETG · Negro');
    });

    test('campos faltantes o nulos no rompen', () {
      final f = Filamento.fromJson({'id': 'x', 'stockGrams': null, 'hex': null});
      expect(f.material, '');
      expect(f.stockGrams, 0);
      expect(f.status, 'ok');
      expect(f.hex, isNull);
    });

    test('toStock() arma el modelo compartido del listado', () {
      final s = Filamento.fromJson({
        'id': 'f1',
        'material': 'PLA',
        'color': 'Rojo',
        'brand': 'Grilon3',
        'diameter': '1.75',
        'stockGrams': 120,
        'spoolGrams': 1000,
        'alertThresholdGrams': 200,
        'status': 'bajo',
        'hex': '#CC2200',
      }).toStock();
      expect(s.isLow, isTrue);
      expect(s.hex, '#CC2200');
      expect(s.spoolGrams, 1000);
    });
  });

  group('FilamentoDraft', () {
    const draft = FilamentoDraft(
      material: 'PLA',
      color: 'Rojo',
      brand: 'Grilon3',
      diameter: '1.75',
      stockGrams: 500,
      spoolGrams: 1000,
      costPerKg: 18000,
      alertThresholdGrams: 200,
    );

    test('el alta manda el stock inicial', () {
      expect(draft.toCreateJson()['stockGrams'], 500);
      expect(draft.toCreateJson()['costPerKg'], 18000);
    });

    test('la edición NO manda stock (el stock se mueve con el ajuste)', () {
      final json = draft.toUpdateJson();
      expect(json.containsKey('stockGrams'), isFalse);
      expect(json['material'], 'PLA');
      expect(json['alertThresholdGrams'], 200);
    });
  });

  group('FilamentMovement.fromJson', () {
    test('lee el historial del ledger', () {
      final m = FilamentMovement.fromJson({
        'id': 'm1',
        'filamentId': 'f1',
        'material': 'PLA',
        'color': 'Rojo',
        'deltaGrams': -80,
        'reason': 'order',
        'reasonLabel': 'Pedido online',
        'ref': 'HF-0042',
        'createdAt': '2026-10-30T15:00:00.000Z',
      });
      expect(m.isDown, isTrue);
      expect(m.ref, 'HF-0042');
      expect(m.createdAt, isNotNull);
    });

    test('un ajuste sin origen y con fecha rota no rompe', () {
      final m = FilamentMovement.fromJson({
        'id': 'm2',
        'deltaGrams': '1000.00',
        'reason': 'adjust',
        'ref': null,
        'createdAt': 'no es una fecha',
      });
      expect(m.deltaGrams, 1000);
      expect(m.isDown, isFalse);
      expect(m.reasonLabel, 'adjust');
      expect(m.ref, isNull);
      expect(m.createdAt, isNull);
    });
  });

  group('FilamentCatalog.fromJson', () {
    test('lee colores con hex, marcas, materiales y diámetros', () {
      final cat = FilamentCatalog.fromJson({
        'colors': [
          {'name': 'Rojo', 'hex': '#CC2200'},
          {'name': 'Sin hex', 'hex': null},
        ],
        'brands': [
          {'name': 'Grilon3'},
        ],
        'materials': [
          {'name': 'PLA'},
          {'name': 'PETG'},
        ],
        'diameters': ['1.75', '2.85'],
      });
      expect(cat.colors, hasLength(2));
      expect(cat.hexOf('  rojo '), '#CC2200');
      expect(cat.hexOf('Sin hex'), isNull);
      expect(cat.hexOf('Verde'), isNull);
      expect(cat.brands, ['Grilon3']);
      expect(cat.materials, ['PLA', 'PETG']);
      expect(cat.diameters, ['1.75', '2.85']);
    });

    test('un catálogo vacío trae los diámetros de siempre', () {
      expect(FilamentCatalog.fromJson({}).diameters, ['1.75', '2.85', '—']);
    });
  });

  test('StockAdjustResult.fromJson', () {
    final r = StockAdjustResult.fromJson({
      'deltaGrams': -180,
      'previousStock': 500,
      'newStock': 320,
      'lowStock': true,
      'filament': {'id': 'f1'},
    });
    expect(r.deltaGrams, -180);
    expect(r.previousStock, 500);
    expect(r.newStock, 320);
    expect(r.lowStock, isTrue);
  });

  group('planAdjust (ajuste de stock)', () {
    test('sumar', () {
      final p = planAdjust(AdjustMode.add, 500, '1000');
      expect(p.isValid, isTrue);
      expect(p.delta, 1000);
      expect(p.newStock, 1500);
    });

    test('restar acepta coma decimal', () {
      final p = planAdjust(AdjustMode.remove, 500, '120,5');
      expect(p.delta, -120.5);
      expect(p.newStock, 379.5);
    });

    test('restar más de lo que hay no se puede', () {
      final p = planAdjust(AdjustMode.remove, 500, '501');
      expect(p.isValid, isFalse);
      expect(p.error, contains('No podés restar'));
      expect(planAdjust(AdjustMode.remove, 0, '5').error, 'No hay stock para restar.');
    });

    test('contado calcula la diferencia contra el stock actual', () {
      final p = planAdjust(AdjustMode.count, 500, '320');
      expect(p.delta, -180);
      expect(p.newStock, 320);
      expect(planAdjust(AdjustMode.count, 500, '500').error, contains('ya es de'));
    });

    test('sumar a un carrete en deuda: hay que cubrir la deuda', () {
      // El servidor no deja que un ajuste manual termine en negativo.
      final p = planAdjust(AdjustMode.add, -30, '20');
      expect(p.isValid, isFalse);
      expect(p.error, contains('debe 30 g'));
      final ok = planAdjust(AdjustMode.add, -30, '100');
      expect(ok.isValid, isTrue);
      expect(ok.newStock, 70);
      expect(planAdjust(AdjustMode.count, -30, '0').isValid, isTrue, reason: 'contar 0 salda la deuda');
    });

    test('vacío no es error pero tampoco es válido', () {
      final p = planAdjust(AdjustMode.add, 500, '  ');
      expect(p.error, isNull);
      expect(p.isValid, isFalse);
    });

    test('cero, negativos y texto', () {
      expect(planAdjust(AdjustMode.add, 500, '0').isValid, isFalse);
      expect(planAdjust(AdjustMode.add, 500, '-5').error, isNotNull);
      expect(planAdjust(AdjustMode.add, 500, 'abc').error, 'Ingresá un número.');
    });
  });

  group('validateFilamentoForm', () {
    Map<String, String> v({
      String material = 'PLA',
      String color = 'Rojo',
      String brand = 'Grilon3',
      String diameter = '1.75',
      String stock = '0',
      String spool = '1000',
      String cost = '18000',
      String threshold = '1000',
      bool create = true,
    }) =>
        validateFilamentoForm(
          material: material,
          color: color,
          brand: brand,
          diameter: diameter,
          stock: stock,
          spool: spool,
          cost: cost,
          threshold: threshold,
          isCreate: create,
        );

    test('un formulario completo es válido', () => expect(v(), isEmpty));

    test('faltan los selectores', () {
      final e = v(material: ' ', color: '', brand: '');
      expect(e.keys, containsAll(['material', 'color', 'brand']));
    });

    test('el carrete tiene que ser mayor a 0', () {
      expect(v(spool: '0')['spool'], isNotNull);
      expect(v(spool: '')['spool'], isNotNull);
    });

    test('costo y umbral no pueden ser negativos', () {
      expect(v(cost: '-1')['cost'], 'El costo no puede ser negativo.');
      expect(v(threshold: '-1')['threshold'], 'El umbral no puede ser negativo.');
    });

    test('el stock inicial solo se valida en el alta', () {
      expect(v(stock: '-5')['stock'], 'El stock no puede ser negativo.');
      expect(v(stock: '-5', create: false), isEmpty);
    });

    test('costo y umbral vacíos cuentan como 0', () {
      expect(v(cost: '', threshold: ''), isEmpty);
    });
  });

  group('formato', () {
    test('formatGrams', () {
      expect(formatGrams(840), '840 g');
      expect(formatGrams(0), '0 g');
      expect(formatGrams(1000), '1,00 kg');
      expect(formatGrams(1250), '1,25 kg');
      expect(formatGrams(-30), '-30 g');
    });

    test('formatGrams no redondea los gramos con decimales', () {
      expect(formatGrams(25.5), '25,5 g');
      expect(formatGrams(25.04), '25 g');
      expect(formatGrams(999.96), '1,00 kg');
    });

    test('formatDeltaGrams lleva signo', () {
      expect(formatDeltaGrams(1000), '+1.000 g');
      expect(formatDeltaGrams(-80), '-80 g');
      expect(formatDeltaGrams(-0.5), '-0,50 g');
    });

    test('parseNumber y gramsField', () {
      expect(parseNumber(' 1,5 '), 1.5);
      expect(parseNumber('1.5'), 1.5);
      expect(parseNumber(''), isNull);
      expect(parseNumber('abc'), isNull);
      expect(gramsField(1000), '1000');
      expect(gramsField(12.5), '12.5');
    });

    test('formatAgo', () {
      expect(formatAgo(0), 'recién');
      expect(formatAgo(5), 'hace 5 h');
      expect(formatAgo(24), 'hace 1 d');
      expect(formatAgo(100), 'hace 4 d');
    });

    test('colorsTemplate lista solo colores con stock, sin repetir y ordenados', () {
      final t = colorsTemplate([
        (color: 'Rojo', stockGrams: 100),
        (color: 'azul', stockGrams: 5),
        (color: 'Rojo', stockGrams: 800),
        (color: 'Negro', stockGrams: 0),
        (color: 'Verde', stockGrams: -20),
      ]);
      expect(t, contains('• azul\n• Rojo'));
      expect(t, isNot(contains('Negro')));
      expect(t, isNot(contains('Verde')));
      expect(t, endsWith('¿Con cuál te gustaría tu pieza?'));
      expect(
        colorsTemplate([(color: 'Negro', stockGrams: 0)]),
        'Por ahora no tenemos colores en stock.',
      );
    });
  });

  group('parseo defensivo', () {
    test('numOf / intOf / strOf', () {
      expect(numOf('12.5'), 12.5);
      expect(numOf('12,5'), 12.5);
      expect(numOf(null, 7), 7);
      expect(numOf('x'), 0);
      expect(intOf('3'), 3);
      expect(intOf(2.9), 2);
      expect(strOf('  hola '), 'hola');
      expect(strOf(null, 'x'), 'x');
      expect(strOrNull('  '), isNull);
    });

    test('mapsOf descarta lo que no es objeto', () {
      expect(mapsOf([1, {'a': 1}, null]), hasLength(1));
      expect(mapsOf('nada'), isEmpty);
    });
  });
}
