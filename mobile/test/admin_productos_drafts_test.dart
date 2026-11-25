import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/features/admin/productos/producto_drafts.dart';
import 'package:hefesto/features/admin/productos/producto_drafts_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Borradores locales del formulario de producto: guardado, tope, datos rotos.
ProductDraft _draft(String id, {String name = 'Mate', int minute = 0, String? productId}) => ProductDraft(
      id: id,
      updatedAt: DateTime(2026, 11, 20, 10, minute),
      fields: ProductDraftFields(name: name, priceText: '1.500,50'),
      productId: productId,
    );

void main() {
  group('ProductDraftFields', () {
    const full = ProductDraftFields(
      name: ' Mate Luigi ',
      description: 'Verde',
      categoryId: 'c-kid',
      categoryLabel: 'Figuras › Funko Pop',
      material: 'PLA',
      priceText: '25.000',
      saleText: '20000,50',
      weightText: '90',
      minutesText: '180',
      dimensions: '12 cm',
      productionTime: '3 días',
      featured: true,
    );

    test('ida y vuelta por JSON conserva todo, tal cual se escribió', () {
      final back = ProductDraftFields.fromJson(
        Map<String, dynamic>.from(jsonDecode(jsonEncode(full.toJson())) as Map),
      );
      expect(back, full);
      expect(back.name, ' Mate Luigi ', reason: 'el texto no se toca');
      expect(back.toValues().price, 25000.0);
      expect(back.toValues().salePrice, 20000.5);
      expect(back.toValues().name, 'Mate Luigi');
    });

    test('vacío = nada cargado; cualquier dato ya cuenta', () {
      expect(const ProductDraftFields().isBlank, isTrue);
      expect(const ProductDraftFields(name: '   ').isBlank, isTrue);
      expect(const ProductDraftFields(name: 'a').isBlank, isFalse);
      expect(const ProductDraftFields(categoryId: 'c1').isBlank, isFalse);
      expect(const ProductDraftFields(featured: true).isBlank, isFalse);
      expect(const ProductDraftFields(minutesText: '3').isBlank, isFalse);
    });

    test('tipos inesperados no rompen: quedan los valores por defecto', () {
      final f = ProductDraftFields.fromJson({'name': 12, 'price': null, 'featured': 'si', 'categoryId': ''});
      expect(f, const ProductDraftFields());
    });
  });

  group('ProductDraft', () {
    test('título: el nombre, o "Producto sin nombre"', () {
      expect(_draft('a', name: ' Mate ').title, 'Mate');
      expect(_draft('a', name: '  ').title, 'Producto sin nombre');
    });

    test('ida y vuelta (con y sin producto)', () {
      final d = ProductDraft(
        id: 'edit-p1',
        updatedAt: DateTime(2026, 11, 20, 10, 30),
        fields: const ProductDraftFields(name: 'Mate'),
        productId: 'p1',
        productUpdatedAt: '2026-10-31T12:00:00.000Z',
      );
      final back = ProductDraft.fromJson(jsonDecode(jsonEncode(d.toJson())))!;
      expect(back.id, 'edit-p1');
      expect(back.updatedAt, d.updatedAt);
      expect(back.fields, d.fields);
      expect(back.productId, 'p1');
      expect(back.productUpdatedAt, '2026-10-31T12:00:00.000Z');
      expect(ProductDraft.fromJson(jsonDecode(jsonEncode(_draft('x').toJson())))!.productId, isNull);
    });

    test('entradas inválidas se ignoran', () {
      expect(ProductDraft.fromJson(null), isNull);
      expect(ProductDraft.fromJson('hola'), isNull);
      expect(ProductDraft.fromJson({'id': 'a'}), isNull);
      expect(ProductDraft.fromJson({'id': 'a', 'updatedAt': 'ayer', 'fields': {}}), isNull);
      expect(ProductDraft.fromJson({'id': 'a', 'updatedAt': '2026-11-20T10:00:00Z', 'fields': 'x'}), isNull);
      expect(ProductDraft.fromJson({'id': '', 'updatedAt': '2026-11-20T10:00:00Z', 'fields': {}}), isNull);
    });
  });

  group('ProductDraftBook', () {
    test('guardar deja el más nuevo primero y actualizar no duplica', () {
      var book = ProductDraftBook.empty.save(_draft('a', minute: 1)).save(_draft('b', minute: 2));
      expect([for (final d in book.drafts) d.id], ['b', 'a']);
      book = book.save(_draft('a', name: 'Mate nuevo', minute: 3));
      expect([for (final d in book.drafts) d.id], ['a', 'b']);
      expect(book.byId('a')!.title, 'Mate nuevo');
    });

    test('tope de 10: se cae el más viejo', () {
      var book = ProductDraftBook.empty;
      for (var i = 0; i < 13; i++) {
        book = book.save(_draft('d$i', minute: i));
      }
      expect(book.drafts, hasLength(kMaxProductDrafts));
      expect(book.drafts.first.id, 'd12');
      expect(book.drafts.last.id, 'd3');
      expect(book.byId('d0'), isNull);
    });

    test('quitar (al crear el producto o al eliminar el borrador)', () {
      final book = ProductDraftBook.empty.save(_draft('a')).save(_draft('b', minute: 1)).remove('a');
      expect([for (final d in book.drafts) d.id], ['b']);
      expect(book.remove('no-existe').drafts, hasLength(1));
    });

    test('ediciones: una por producto, aparte de los borradores nuevos', () {
      var book = ProductDraftBook.empty
          .save(_draft('a'))
          .saveEdit(_draft('edit-p1', productId: 'p1', minute: 1))
          .saveEdit(_draft('edit-p2', productId: 'p2', minute: 2))
          .saveEdit(_draft('edit-p1', name: 'Otro', productId: 'p1', minute: 3));
      expect(book.drafts, hasLength(1));
      expect([for (final d in book.edits) d.productId], ['p1', 'p2']);
      expect(book.editOf('p1')!.title, 'Otro');
      expect(book.editOf('p9'), isNull);
      // Sin producto no es una edición: no se guarda.
      expect(book.saveEdit(_draft('x')).edits, hasLength(2));
      book = book.removeEdit('p1');
      expect(book.editOf('p1'), isNull);
      expect(book.drafts, hasLength(1));
    });

    test('ida y vuelta por texto', () {
      final book = ProductDraftBook.empty
          .save(_draft('a', minute: 1))
          .save(_draft('b', minute: 2))
          .saveEdit(_draft('edit-p1', productId: 'p1'));
      final back = ProductDraftBook.decode(book.encode());
      expect([for (final d in back.drafts) d.id], ['b', 'a']);
      expect(back.drafts.first.fields, book.drafts.first.fields);
      expect(back.editOf('p1'), isNotNull);
      expect(jsonDecode(book.encode())['version'], kProductDraftsVersion);
    });

    test('texto roto, vacío o de otra versión: queda vacío, nunca lanza', () {
      for (final raw in <String?>[
        null,
        '',
        '   ',
        'no es json',
        '[]',
        '42',
        '{"version":999,"drafts":[]}',
        '{"drafts":[]}',
        '{"version":1,"drafts":"x","edits":7}',
        '{"version":1',
      ]) {
        final book = ProductDraftBook.decode(raw);
        expect(book.drafts, isEmpty, reason: '$raw');
        expect(book.edits, isEmpty, reason: '$raw');
      }
    });

    test('entradas rotas o repetidas se saltean y el resto se conserva', () {
      final good = _draft('a').toJson();
      final raw = jsonEncode({
        'version': kProductDraftsVersion,
        'drafts': [
          'basura',
          {'id': 'x'},
          good,
          good,
          _draft('edit-p1', productId: 'p1').toJson(), // una edición no va acá
          for (var i = 0; i < 15; i++) _draft('n$i', minute: i + 1).toJson(),
        ],
        'edits': [null, _draft('suelto').toJson()],
      });
      final book = ProductDraftBook.decode(raw);
      expect(book.drafts, hasLength(kMaxProductDrafts));
      expect(book.drafts.first.id, 'n14');
      expect(book.edits, isEmpty);
    });
  });

  test('draftAgo', () {
    final now = DateTime(2026, 11, 20, 12, 0);
    expect(draftAgo(now.subtract(const Duration(seconds: 20)), now), 'recién');
    expect(draftAgo(now.subtract(const Duration(minutes: 5)), now), 'hace 5 min');
    expect(draftAgo(now.subtract(const Duration(hours: 3)), now), 'hace 3 h');
    expect(draftAgo(now.subtract(const Duration(hours: 30)), now), 'ayer');
    expect(draftAgo(DateTime(2026, 10, 2, 9), now), 'el 02/10/2026');
  });

  group('ProductDraftsController', () {
    Future<ProviderContainer> container([Map<String, Object> initial = const {}]) async {
      SharedPreferences.setMockInitialValues(initial);
      final prefs = await SharedPreferences.getInstance();
      final c = ProviderContainer(overrides: [sharedPrefsProvider.overrideWithValue(prefs)]);
      addTearDown(c.dispose);
      return c;
    }

    test('guarda en el teléfono y se vuelve a leer al abrir la app', () async {
      final c = await container();
      final drafts = c.read(productDraftsProvider.notifier);
      drafts.save(_draft('a', minute: 1));
      drafts.save(_draft('b', minute: 2));
      drafts.saveEdit(_draft('edit-p1', productId: 'p1'));
      expect(c.read(productDraftsProvider).drafts, hasLength(2));

      final prefs = c.read(sharedPrefsProvider);
      final raw = prefs.getString(ProductDraftsController.storageKey);
      expect(raw, isNotNull);

      // "Otra sesión": un contenedor nuevo sobre lo mismo guardado.
      final again = ProviderContainer(overrides: [sharedPrefsProvider.overrideWithValue(prefs)]);
      addTearDown(again.dispose);
      final book = again.read(productDraftsProvider);
      expect([for (final d in book.drafts) d.id], ['b', 'a']);
      expect(book.editOf('p1'), isNotNull);
    });

    test('al guardar el producto, su borrador se quita (también del teléfono)', () async {
      final c = await container();
      final drafts = c.read(productDraftsProvider.notifier);
      drafts.save(_draft('a'));
      drafts.saveEdit(_draft('edit-p1', productId: 'p1'));
      drafts.remove('a');
      drafts.removeEdit('p1');
      expect(c.read(productDraftsProvider).drafts, isEmpty);
      expect(c.read(productDraftsProvider).edits, isEmpty);
      final saved = ProductDraftBook.decode(
        c.read(sharedPrefsProvider).getString(ProductDraftsController.storageKey),
      );
      expect(saved.drafts, isEmpty);
      expect(saved.edits, isEmpty);
    });

    test('lo guardado está roto: arranca vacío y sigue funcionando', () async {
      final c = await container({ProductDraftsController.storageKey: '{{{ roto'});
      expect(c.read(productDraftsProvider).drafts, isEmpty);
      c.read(productDraftsProvider.notifier).save(_draft('a'));
      expect(c.read(productDraftsProvider).drafts, hasLength(1));
    });

    test('sin almacenamiento disponible no lanza: vive en memoria', () {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      expect(c.read(productDraftsProvider).drafts, isEmpty);
      c.read(productDraftsProvider.notifier).save(_draft('a'));
      expect(c.read(productDraftsProvider).drafts, hasLength(1));
    });
  });
}
