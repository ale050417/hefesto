import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/arreglos/arreglos_models.dart';

/// Un arreglo con la forma real de `FixView` (`/api/v1/admin/arreglos`).
Map<String, dynamic> fixJson(
  String id, {
  String title = 'El buscador no encuentra por color',
  String description = 'Si buscás "rojo" no aparece ningún producto.',
  bool urgent = false,
  String status = 'pending',
  List<String> images = const [],
  String? ownerNote,
  String author = 'Antonella',
  bool mine = false,
  String createdAt = '2026-11-15T13:00:00.000Z',
  String? resolvedAt,
}) =>
    {
      'id': id,
      'title': title,
      'description': description,
      'urgent': urgent,
      'status': status,
      'images': images,
      'ownerNote': ownerNote,
      'author': author,
      'mine': mine,
      'createdAt': createdAt,
      'resolvedAt': resolvedAt,
    };

/// JSON con la forma real de `GET /api/v1/admin/arreglos`.
Map<String, dynamic> arreglosJson() => {
      'items': [
        fixJson(
          'x1',
          urgent: true,
          mine: true,
          images: ['https://cdn.test/arreglos/x1/a.jpg', 'https://cdn.test/arreglos/x1/b.jpg'],
        ),
        fixJson(
          'x2',
          title: 'Agregar botón de imprimir etiqueta',
          description: 'En el detalle de la venta, para pegar en la caja.',
          status: 'in_progress',
          ownerNote: 'Lo estoy armando, sale esta semana.',
          author: 'Lucas',
        ),
        fixJson(
          'x3',
          title: 'La app se cerraba al abrir Reportes',
          description: 'Pasaba en el teléfono del taller.',
          urgent: true,
          status: 'done',
          ownerNote: 'Arreglado en la versión nueva.',
          author: 'Lucas',
          resolvedAt: '2026-11-16T18:30:00.000Z',
        ),
      ],
      'statuses': {'pending': 'Pendiente', 'in_progress': 'En curso', 'done': 'Resuelto'},
      'maxImages': 6,
    };

void main() {
  group('ArreglosData.fromJson', () {
    final d = ArreglosData.fromJson(arreglosJson());

    test('lee los arreglos con sus campos', () {
      expect(d.items, hasLength(3));
      final a = d.items.first;
      expect(a.id, 'x1');
      expect(a.title, 'El buscador no encuentra por color');
      expect(a.urgent, isTrue);
      expect(a.status, FixStatus.pending);
      expect(a.images, hasLength(2));
      expect(a.ownerNote, isNull);
      expect(a.author, 'Antonella');
      expect(a.mine, isTrue);
      expect(a.createdAt, DateTime.utc(2026, 11, 15, 13).toLocal());
      expect(a.resolvedAt, isNull);

      final done = d.items[2];
      expect(done.status, FixStatus.done);
      expect(done.ownerNote, 'Arreglado en la versión nueva.');
      expect(done.resolvedAt, isNotNull);
      expect(d.items[1].status, FixStatus.inProgress);
    });

    test('rótulos de estado y tope de fotos del servidor', () {
      expect(d.labelOf(FixStatus.pending), 'Pendiente');
      expect(d.labelOf(FixStatus.inProgress), 'En curso');
      expect(d.labelOf(FixStatus.done), 'Resuelto');
      expect(d.maxImages, 6);

      final custom = ArreglosData.fromJson({
        'items': <dynamic>[],
        'statuses': {'pending': 'Por ver'},
        'maxImages': 3,
      });
      expect(custom.labelOf(FixStatus.pending), 'Por ver');
      expect(custom.labelOf(FixStatus.done), 'Resuelto', reason: 'lo que falta usa el rótulo de la app');
      expect(custom.maxImages, 3);
    });

    test('respuesta vacía o rota no rompe', () {
      final empty = ArreglosData.fromJson({});
      expect(empty.items, isEmpty);
      expect(empty.maxImages, 6);
      expect(empty.labelOf(FixStatus.inProgress), 'En curso');

      final odd = ArreglosData.fromJson({
        'items': [
          {'id': 'z', 'status': 'archivado', 'images': null, 'urgent': 'sí', 'author': null},
          'basura',
        ],
        'maxImages': 0,
      });
      expect(odd.items, hasLength(1));
      final a = odd.items.single;
      expect(a.status, FixStatus.pending, reason: 'un estado desconocido queda como pendiente');
      expect(a.images, isEmpty);
      expect(a.urgent, isFalse);
      expect(a.author, 'Alguien del equipo');
      expect(a.createdAt, isNull);
      expect(odd.maxImages, 6);
    });

    test('filtros y sus cuentas', () {
      expect(d.count(FixFilter.open), 2);
      expect(d.count(FixFilter.pending), 1);
      expect(d.count(FixFilter.inProgress), 1);
      expect(d.count(FixFilter.done), 1);
      expect(d.count(FixFilter.all), 3);
      expect(FixFilter.values.map((f) => f.label), ['Por resolver', 'Pendientes', 'En curso', 'Resueltos', 'Todos']);
    });
  });

  group('reglas de un arreglo', () {
    final d = ArreglosData.fromJson(arreglosJson());

    test('"Urgente" se marca solo mientras no está resuelto', () {
      expect(d.items[0].showUrgent, isTrue);
      expect(d.items[1].showUrgent, isFalse, reason: 'no es urgente');
      expect(d.items[2].showUrgent, isFalse, reason: 'urgente pero ya resuelto');
    });

    test('borrar: con el permiso, o si es mío y sigue pendiente', () {
      final minePending = d.items[0];
      final othersInProgress = d.items[1];
      expect(minePending.deletableBy(canDelete: false), isTrue);
      expect(othersInProgress.deletableBy(canDelete: false), isFalse);
      expect(othersInProgress.deletableBy(canDelete: true), isTrue);

      final mineInProgress = Arreglo.fromJson(fixJson('m', mine: true, status: 'in_progress'));
      expect(mineInProgress.deletableBy(canDelete: false), isFalse, reason: 'mío pero ya lo tomaron');
      final othersPending = Arreglo.fromJson(fixJson('o'));
      expect(othersPending.deletableBy(canDelete: false), isFalse);
    });
  });

  group('lo que se manda', () {
    test('alta: recorta espacios y manda urgent', () {
      const draft = ArregloDraft(title: '  Falla el login ', description: ' No deja entrar con Google. ', urgent: true);
      expect(draft.toJson(), {
        'title': 'Falla el login',
        'description': 'No deja entrar con Google.',
        'urgent': true,
      });
    });

    test('respuesta: estado de la API y nota (vacía = null)', () {
      expect(arregloUpdateJson(FixStatus.inProgress, ' Ya lo miro '), {
        'status': 'in_progress',
        'ownerNote': 'Ya lo miro',
      });
      expect(arregloUpdateJson(FixStatus.done, '   '), {'status': 'done', 'ownerNote': null});
      expect(FixStatus.values.map((s) => s.api), ['pending', 'in_progress', 'done']);
    });
  });

  group('validateArregloForm', () {
    test('título de 3 a 120 y descripción de 5 a 4000', () {
      expect(validateArregloForm(title: 'Ab', description: 'Corta'), {
        'title': 'Poné un título corto (qué hay que arreglar).',
      });
      expect(validateArregloForm(title: 'Abc', description: 'Cort')['description'],
          'Explicá qué pasa y qué habría que cambiar.');
      expect(validateArregloForm(title: '   ', description: '    ').keys, {'title', 'description'});
      expect(validateArregloForm(title: 'a' * 121, description: 'b' * 4001).keys, {'title', 'description'});
      expect(validateArregloForm(title: 'a' * 120, description: 'b' * 4000), isEmpty);
      expect(validateArregloForm(title: ' Abc ', description: ' Hola! '), isEmpty);
    });
  });
}
