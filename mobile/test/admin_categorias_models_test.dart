import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/features/admin/categorias/categorias_models.dart';

// JSON con la forma REAL de GET /api/v1/admin/categorias (ver admin-api.ts):
// Figuras › Funko Pop › Superhéroes, y Llaveros aparte.
Map<String, dynamic> cat(
  String id,
  String name, {
  String? parentId,
  int depth = 0,
  String? path,
  int products = 0,
  int total = 0,
  int children = 0,
  int descendants = 0,
  String? icon,
  String? color = '#C9A84C',
  String? imageUrl,
}) =>
    {
      'id': id,
      'name': name,
      'slug': name.toLowerCase(),
      'icon': icon,
      'color': color,
      'imageUrl': imageUrl,
      'sortOrder': 0,
      'parentId': parentId,
      'depth': depth,
      'path': path ?? name,
      'productCount': products,
      'totalProductCount': total,
      'childCount': children,
      'descendantCount': descendants,
    };

final payload = {
  'items': [
    cat('f', 'Figuras', products: 2, total: 9, children: 1, descendants: 2, icon: 'star'),
    cat('fp', 'Funko Pop',
        parentId: 'f', depth: 1, path: 'Figuras › Funko Pop', products: 3, total: 7, children: 1, descendants: 1),
    cat('sh', 'Superhéroes',
        parentId: 'fp', depth: 2, path: 'Figuras › Funko Pop › Superhéroes', products: 4, total: 4),
    cat('l', 'Llaveros', products: 5, total: 5, icon: 'key', color: null),
  ],
  'summary': {'total': 4, 'roots': 2, 'subcategories': 2, 'productsCategorized': 14},
};

void main() {
  group('AdminCategoriesData', () {
    final data = AdminCategoriesData.fromJson(payload);

    test('parsea el árbol en el orden que manda el servidor', () {
      expect(data.items.map((c) => c.name), ['Figuras', 'Funko Pop', 'Superhéroes', 'Llaveros']);
      expect(data.items.map((c) => c.depth), [0, 1, 2, 0]);
      expect(data.items[2].path, 'Figuras › Funko Pop › Superhéroes');
      expect(data.items[0].totalProductCount, 9);
      expect(data.items[0].hasChildren, isTrue);
      expect(data.items[2].hasChildren, isFalse);
      expect(data.summary.roots, 2);
      expect(data.summary.subcategories, 2);
      expect(data.summary.productsCategorized, 14);
    });

    test('sin color ni ícono no rompe', () {
      final l = data.items[3];
      expect(l.color, isNull);
      expect(categoryIconData(l.icon), kCategoryIcons['key']);
      expect(categoryIconData(null), kCategoryIcons['box'], reason: 'sin ícono, la caja de la web');
      expect(categoryIconData('inventado'), kCategoryIcons['box']);
    });

    test('datos raros: números como String, listas vacías, basura', () {
      final d = AdminCategoriesData.fromJson({
        'items': [
          {'id': 'x', 'name': 'X', 'productCount': '3', 'depth': '1', 'imageUrl': ''},
          7,
        ],
      });
      expect(d.items, hasLength(1));
      expect(d.items.single.productCount, 3);
      expect(d.items.single.depth, 1);
      expect(d.items.single.imageUrl, isNull);
      expect(d.summary.total, 0);
      expect(AdminCategoriesData.fromJson({}).items, isEmpty);
    });

    test('toOption conserva la ruta para los selectores', () {
      final o = data.items[1].toOption();
      expect(o.id, 'fp');
      expect(o.path, 'Figuras › Funko Pop');
      expect(o.depth, 1);
      expect(o.parentId, 'f');
    });
  });

  group('descendantIdsOf', () {
    final all = AdminCategoriesData.fromJson(payload).items;

    test('toda la descendencia, sin la propia', () {
      expect(descendantIdsOf(all, 'f'), {'fp', 'sh'});
      expect(descendantIdsOf(all, 'fp'), {'sh'});
      expect(descendantIdsOf(all, 'sh'), isEmpty);
      expect(descendantIdsOf(all, 'l'), isEmpty);
    });

    test('un ciclo raro en los datos no cuelga ni se incluye a sí misma', () {
      final cyc = AdminCategoriesData.fromJson({
        'items': [
          cat('a', 'A', parentId: 'b'),
          cat('b', 'B', parentId: 'a'),
        ],
      }).items;
      expect(descendantIdsOf(cyc, 'a'), {'b'});
    });
  });

  group('visibleCategories', () {
    final all = AdminCategoriesData.fromJson(payload).items;

    test('plegado: solo las principales', () {
      expect(visibleCategories(all, {}).map((c) => c.id), ['f', 'l']);
    });

    test('desplegar un padre muestra sus hijas, no las nietas', () {
      expect(visibleCategories(all, {'f'}).map((c) => c.id), ['f', 'fp', 'l']);
    });

    test('para ver una nieta hay que desplegar toda la cadena', () {
      expect(visibleCategories(all, {'f', 'fp'}).map((c) => c.id), ['f', 'fp', 'sh', 'l']);
      expect(visibleCategories(all, {'fp'}).map((c) => c.id), ['f', 'l'],
          reason: 'fp desplegada pero su padre no: la nieta sigue escondida');
    });

    test('la búsqueda es plana y mira el nombre y la ruta', () {
      expect(visibleCategories(all, {}, query: 'super').map((c) => c.id), ['sh']);
      expect(visibleCategories(all, {}, query: 'FUNKO').map((c) => c.id), ['fp', 'sh']);
      expect(visibleCategories(all, {}, query: 'zzz'), isEmpty);
    });

    test('un padre que no está en la lista cuenta como raíz', () {
      final huerfana = AdminCategoriesData.fromJson({
        'items': [cat('h', 'Huérfana', parentId: 'no-existe', depth: 1)],
      }).items;
      expect(visibleCategories(huerfana, {}).map((c) => c.id), ['h']);
    });
  });

  // Contrato con la web: los íconos y colores de la app son los MISMOS que
  // ofrece el formulario de la web (category-icons.ts). Si la web suma uno y la
  // app no, este test avisa.
  group('íconos y colores = los de la web', () {
    final file = File('../src/features/products/category-icons.ts');

    test('íconos', () {
      if (!file.existsSync()) {
        markTestSkipped('No está el código de la web junto a la app.');
        return;
      }
      final src = file.readAsStringSync();
      final block = RegExp(r'CAT_ICONS\s*=\s*\[([\s\S]*?)\]\s*as const').firstMatch(src)!.group(1)!;
      final web = RegExp(r'"(\w+)"').allMatches(block).map((m) => m.group(1)!).toList();
      expect(web, isNotEmpty);
      expect(kCategoryIcons.keys.toList(), web, reason: 'mismos íconos y en el mismo orden');
    });

    test('colores', () {
      if (!file.existsSync()) {
        markTestSkipped('No está el código de la web junto a la app.');
        return;
      }
      final src = file.readAsStringSync();
      final block = RegExp(r'CAT_COLORS\s*=\s*\[([\s\S]*?)\];').firstMatch(src)!.group(1)!;
      final web = RegExp(r'"(#[0-9A-Fa-f]{6})"').allMatches(block).map((m) => m.group(1)!).toList();
      expect(web, isNotEmpty);
      expect(kCategoryColors, web);
    });

    test('cada ícono es un IconData', () {
      for (final e in kCategoryIcons.entries) {
        expect(e.value, isA<IconData>(), reason: e.key);
      }
    });

    // Lo que se le muestra / lee a la persona va en castellano: si la web suma
    // un ícono o un color, acá tiene que sumarse también su nombre.
    test('cada ícono y cada color tiene su nombre en castellano', () {
      expect(kCategoryIconLabels.keys.toList(), kCategoryIcons.keys.toList());
      expect(kCategoryColorLabels.keys.toList(), kCategoryColors);
      expect(kCategoryIconLabels.values.toSet(), hasLength(kCategoryIcons.length),
          reason: 'dos íconos no pueden llamarse igual');
      expect(kCategoryColorLabels.values.toSet(), hasLength(kCategoryColors.length));
    });
  });
}
