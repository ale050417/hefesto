import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/pendientes/pendientes_models.dart';

import 'support/sales_kit.dart';

void main() {
  group('PendientesData.fromJson', () {
    final d = PendientesData.fromJson(pendientesJson());

    test('lee los abiertos y los hechos con la forma real de la API', () {
      expect(d.open, hasLength(3));
      expect(d.done, hasLength(2));
      expect(d.maxLength, 500);
      final t = d.open.first;
      expect(t.id, 't1');
      expect(t.body, 'Cargar el pedido de Nico (2 llaveros)');
      expect(t.done, isFalse);
      expect(t.author, 'Agustín');
      expect(t.mine, isTrue);
      expect(t.createdAt!.toUtc(), DateTime.utc(2026, 11, 17, 14, 3, 11));
      expect(t.doneBy, isNull);
      expect(t.doneAt, isNull);
    });

    test('un hecho trae quién lo tildó y cuándo', () {
      final t = d.done.first;
      expect(t.done, isTrue);
      expect(t.doneBy, 'Antonella');
      expect(t.doneAt!.toUtc(), DateTime.utc(2026, 11, 17, 18, 20));
    });

    test('respuesta vacía o rara no rompe', () {
      final empty = PendientesData.fromJson({});
      expect(empty.open, isEmpty);
      expect(empty.done, isEmpty);
      expect(empty.maxLength, 500);
      final odd = PendientesData.fromJson({
        'open': [
          {'id': '', 'body': 'sin id'},
          'basura',
          {'id': 'x', 'body': 'Sin autor', 'createdAt': 'no es fecha'},
        ],
        'done': null,
        'maxLength': 0,
      });
      expect(odd.open.single.id, 'x');
      expect(odd.open.single.author, 'Alguien del equipo');
      expect(odd.open.single.createdAt, isNull);
      expect(odd.open.single.mine, isFalse);
      expect(odd.maxLength, 500);
    });
  });

  group('reglas', () {
    test('lo borra quien lo anotó o quien puede eliminar pedidos', () {
      final mine = TeamTask.fromJson(taskJson('a', mine: true));
      final other = TeamTask.fromJson(taskJson('b'));
      expect(mine.deletableBy(canDelete: false), isTrue);
      expect(other.deletableBy(canDelete: false), isFalse);
      expect(other.deletableBy(canDelete: true), isTrue);
    });

    test('texto: obligatorio y hasta el tope del servidor', () {
      expect(validateTaskBody('Llamar a Nico'), isNull);
      expect(validateTaskBody('   '), 'Escribí el pendiente.');
      expect(validateTaskBody('x' * 500), isNull);
      expect(validateTaskBody('x' * 501), 'Máximo 500 caracteres.');
      // Los espacios de los bordes no cuentan (el servidor recorta).
      expect(validateTaskBody('  ${'x' * 500}  '), isNull);
      expect(validateTaskBody('x' * 201, maxLength: 200), 'Máximo 200 caracteres.');
    });
  });

  group('textos', () {
    test('la entrada de Ventas lleva la cantidad cuando se sabe', () {
      expect(pendientesEntryLabel(null), 'Pendientes del equipo');
      expect(pendientesEntryLabel(0), 'Pendientes del equipo · 0');
      expect(pendientesEntryLabel(3), 'Pendientes del equipo · 3');
    });

    test('cuántos hay, como en la web', () {
      expect(pendientesCountLabel(0), 'Nada pendiente');
      expect(pendientesCountLabel(1), '1 pendiente');
      expect(pendientesCountLabel(7), '7 pendientes');
    });
  });
}
