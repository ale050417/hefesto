import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/fallas/falla_form_screen.dart';
import 'package:hefesto/features/admin/fallas/fallas_models.dart';

/// JSON con la forma real de `GET /api/v1/admin/fallas`.
Map<String, dynamic> fallasJson() => {
      'items': [
        {
          'id': 'a1',
          'createdAt': '2026-10-30T10:00:00.000Z',
          'pieceName': 'Lámpara lunar',
          'material': 'PLA',
          'color': 'Rojo',
          'gramsLost': 150,
          'reason': 'Boquilla tapada',
          'notes': 'Se tapó a la mitad',
          'deducted': true,
          'cost': 3000,
          'hex': '#CC2200',
        },
        {
          // Falla vieja: sin material, color ni notas, gramos como String.
          'id': 'a2',
          'createdAt': '2026-10-01T10:00:00.000Z',
          'pieceName': '',
          'material': '',
          'color': '',
          'gramsLost': '25.50',
          'reason': 'Corte de luz',
          'notes': null,
          'deducted': false,
          'cost': 0,
          'hex': null,
        },
      ],
      'summary': {
        'count': 2,
        'totalGrams': 175.5,
        'totalCost': 3000,
        'topReason': 'Boquilla tapada',
        'topReasonCount': 1,
      },
      'filaments': [
        {'id': 'f1', 'material': 'PLA', 'color': 'Rojo', 'brand': 'Grilon3', 'stockGrams': 840, 'hex': '#CC2200'},
        {'id': 'f2', 'material': 'PETG', 'color': 'Negro', 'brand': '', 'stockGrams': '1000.00', 'hex': null},
      ],
      'materials': ['PLA', 'PETG'],
      'reasons': ['Corte de luz', 'Boquilla tapada', 'Otro'],
    };

void main() {
  group('FallasData.fromJson', () {
    final d = FallasData.fromJson(fallasJson());

    test('lee las fallas con sus campos', () {
      expect(d.items, hasLength(2));
      final f = d.items.first;
      expect(f.pieceName, 'Lámpara lunar');
      expect(f.gramsLost, 150);
      expect(f.cost, 3000);
      expect(f.deducted, isTrue);
      expect(f.notes, 'Se tapó a la mitad');
      expect(f.filamentLabel, 'PLA · Rojo');
      expect(f.createdAt, isNotNull);
    });

    test('una falla vieja (sin material ni notas) no rompe', () {
      final f = d.items.last;
      expect(f.gramsLost, 25.5);
      expect(f.filamentLabel, '');
      expect(f.notes, isNull);
      expect(f.hex, isNull);
      expect(f.deducted, isFalse);
    });

    test('lee el resumen', () {
      expect(d.summary.count, 2);
      expect(d.summary.totalGrams, 175.5);
      expect(d.summary.topReason, 'Boquilla tapada');
    });

    test('lee los carretes, con la marca en la etiqueta', () {
      expect(d.filaments, hasLength(2));
      expect(d.filaments.first.tag, 'PLA · Rojo · Grilon3');
      expect(d.filaments.last.tag, 'PETG · Negro');
      expect(d.filaments.last.stockGrams, 1000);
    });

    test('materiales y causas', () {
      expect(d.materials, ['PLA', 'PETG']);
      expect(d.reasons, ['Corte de luz', 'Boquilla tapada', 'Otro']);
    });

    test('sin resumen ni causas se arma con valores por defecto', () {
      final x = FallasData.fromJson({
        'items': [
          {'id': 'z', 'pieceName': 'X', 'gramsLost': 10, 'cost': 200, 'reason': 'Otro'},
        ],
      });
      expect(x.summary.count, 1);
      expect(x.summary.totalGrams, 10);
      expect(x.summary.totalCost, 200);
      expect(x.reasons, defaultFailReasons);
      expect(x.filaments, isEmpty);
    });

    test('un cuerpo vacío no rompe', () {
      final x = FallasData.fromJson({});
      expect(x.items, isEmpty);
      expect(x.summary.count, 0);
    });
  });

  test('FallaResult.fromJson', () {
    final r = FallaResult.fromJson({'lowStock': true, 'deducted': true});
    expect(r.lowStock, isTrue);
    expect(r.deducted, isTrue);
    expect(FallaResult.fromJson({}).deducted, isFalse);
  });

  group('FallaDraft', () {
    const draft = FallaDraft(
      pieceName: 'Lámpara',
      material: 'PLA',
      color: 'Rojo',
      gramsLost: 150,
      reason: 'Otro',
      notes: '  se cayó  ',
      lines: [
        FallaLine(filamentId: 'f1', grams: 100),
        FallaLine(filamentId: 'f2', grams: 50),
      ],
    );

    test('el alta manda deducted y una línea por carrete (multicolor)', () {
      final json = draft.toCreateJson();
      expect(json['deducted'], isTrue);
      expect(json['gramsLost'], 150);
      expect(json['notes'], 'se cayó');
      expect(json['colorLines'], [
        {'filamentId': 'f1', 'grams': 100.0},
        {'filamentId': 'f2', 'grams': 50.0},
      ]);
    });

    test('la corrección no manda líneas ni deducted (no toca el stock)', () {
      final json = draft.toUpdateJson();
      expect(json.containsKey('colorLines'), isFalse);
      expect(json.containsKey('deducted'), isFalse);
      expect(json['pieceName'], 'Lámpara');
    });

    test('sin notas, no manda el campo', () {
      const d = FallaDraft(pieceName: 'X', material: 'PLA', color: 'Rojo', gramsLost: 1, reason: 'Otro');
      expect(d.toUpdateJson().containsKey('notes'), isFalse);
    });
  });

  group('validateFallaForm', () {
    test('alta: hace falta la pieza y al menos un carrete con gramos', () {
      final e = validateFallaForm(
        pieceName: ' ',
        isEdit: false,
        lines: [(filamentId: '', grams: '')],
      );
      expect(e.keys, containsAll(['pieceName', 'lines']));
    });

    test('alta: una línea con carrete pero sin gramos no alcanza', () {
      expect(
        validateFallaForm(pieceName: 'X', isEdit: false, lines: [(filamentId: 'f1', grams: '0')]),
        contains('lines'),
      );
    });

    test('alta: alcanza con una línea válida (las vacías se ignoran)', () {
      expect(
        validateFallaForm(
          pieceName: 'Lámpara',
          isEdit: false,
          lines: [(filamentId: 'f1', grams: '12,5'), (filamentId: '', grams: '')],
        ),
        isEmpty,
      );
    });

    test('edición: material, color y gramos obligatorios', () {
      final e = validateFallaForm(pieceName: 'X', isEdit: true, grams: '0');
      expect(e.keys, containsAll(['material', 'color', 'grams']));
      expect(
        validateFallaForm(pieceName: 'X', isEdit: true, grams: '5', material: 'PLA', color: 'Rojo'),
        isEmpty,
      );
    });

    test('las notas tienen tope de 500 letras', () {
      expect(
        validateFallaForm(
          pieceName: 'X',
          isEdit: true,
          grams: '5',
          material: 'PLA',
          color: 'Rojo',
          notes: 'x' * 501,
        ),
        contains('notes'),
      );
    });
  });
}
