// Modelos de Categorías del panel (`/api/v1/admin/categorias`). El servidor
// manda la lista ya en orden de árbol, con profundidad, ruta y conteos; la app
// solo la muestra. Parseo defensivo (nulls, números como String).

import 'package:flutter/material.dart';

import '../productos/productos_models.dart';

int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _s(dynamic v) {
  final s = v?.toString().trim();
  return (s == null || s.isEmpty) ? null : s;
}

class AdminCategory {
  AdminCategory({
    required this.id,
    required this.name,
    required this.slug,
    required this.icon,
    required this.color,
    required this.imageUrl,
    required this.parentId,
    required this.depth,
    required this.path,
    required this.productCount,
    required this.totalProductCount,
    required this.childCount,
    required this.descendantCount,
  });

  final String id;
  final String name;
  final String slug;
  final String? icon;

  /// `#RRGGBB` o null.
  final String? color;
  final String? imageUrl;
  final String? parentId;

  /// 0 = categoría principal, 1 = subcategoría, 2 = sub de sub…
  final int depth;

  /// "Figuras › Funko Pop › Superhéroes".
  final String path;

  /// Productos de esta categoría (de cualquier estado).
  final int productCount;

  /// Productos de ella y de todas sus subcategorías.
  final int totalProductCount;
  final int childCount;
  final int descendantCount;

  bool get hasChildren => childCount > 0;

  factory AdminCategory.fromJson(Map<String, dynamic> j) => AdminCategory(
        id: '${j['id']}',
        name: (j['name'] as String?) ?? 'Sin nombre',
        slug: (j['slug'] as String?) ?? '',
        icon: _s(j['icon']),
        color: _s(j['color']),
        imageUrl: _s(j['imageUrl']),
        parentId: _s(j['parentId']),
        depth: _i(j['depth']),
        path: (j['path'] as String?) ?? (j['name'] as String?) ?? '',
        productCount: _i(j['productCount']),
        totalProductCount: _i(j['totalProductCount']),
        childCount: _i(j['childCount']),
        descendantCount: _i(j['descendantCount']),
      );

  CategoryOption toOption() =>
      CategoryOption(id: id, name: name, parentId: parentId, depth: depth, path: path);
}

class CategorySummary {
  const CategorySummary({
    this.total = 0,
    this.roots = 0,
    this.subcategories = 0,
    this.productsCategorized = 0,
  });
  final int total;
  final int roots;
  final int subcategories;
  final int productsCategorized;

  factory CategorySummary.fromJson(Map<String, dynamic>? j) => j == null
      ? const CategorySummary()
      : CategorySummary(
          total: _i(j['total']),
          roots: _i(j['roots']),
          subcategories: _i(j['subcategories']),
          productsCategorized: _i(j['productsCategorized']),
        );
}

class AdminCategoriesData {
  AdminCategoriesData({required this.items, required this.summary});

  /// En orden de árbol: cada categoría seguida de sus subcategorías.
  final List<AdminCategory> items;
  final CategorySummary summary;

  factory AdminCategoriesData.fromJson(Map<String, dynamic> j) => AdminCategoriesData(
        items: ((j['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => AdminCategory.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        summary: CategorySummary.fromJson(
          j['summary'] is Map ? Map<String, dynamic>.from(j['summary'] as Map) : null,
        ),
      );
}

/// Ids de TODA la descendencia de [id] (hijas, nietas…), sin incluir la propia.
/// Tolera ciclos raros en los datos (no se cuelga).
Set<String> descendantIdsOf(List<AdminCategory> all, String id) {
  final byParent = <String, List<String>>{};
  for (final c in all) {
    final p = c.parentId;
    if (p != null) (byParent[p] ??= []).add(c.id);
  }
  final out = <String>{};
  final stack = [...?byParent[id]];
  while (stack.isNotEmpty) {
    final cur = stack.removeLast();
    if (cur == id || !out.add(cur)) continue;
    stack.addAll(byParent[cur] ?? const []);
  }
  return out;
}

/// Filas visibles del árbol: una categoría se ve si todos sus antepasados están
/// desplegados. Con [query] la lista pasa a ser plana (coincidencias por nombre
/// o ruta) para encontrar rápido una subcategoría escondida.
List<AdminCategory> visibleCategories(
  List<AdminCategory> all,
  Set<String> expanded, {
  String query = '',
}) {
  final q = query.trim().toLowerCase();
  if (q.isNotEmpty) {
    return all.where((c) => c.path.toLowerCase().contains(q)).toList();
  }
  final byId = {for (final c in all) c.id: c};
  bool visible(AdminCategory c) {
    var cur = c;
    final seen = <String>{c.id};
    while (cur.parentId != null) {
      final parent = byId[cur.parentId];
      if (parent == null) return true; // padre fuera de la lista: cuenta como raíz
      if (!expanded.contains(parent.id) || !seen.add(parent.id)) return false;
      cur = parent;
    }
    return true;
  }

  return all.where(visible).toList();
}

// --- Íconos y colores (los mismos que ofrece la web al editar una categoría) ---

/// Nombre del ícono (el que guarda el servidor) → ícono de Material.
const Map<String, IconData> kCategoryIcons = {
  'lamp': Icons.lightbulb_outline_rounded,
  'cpu': Icons.memory_rounded,
  'gamepad': Icons.sports_esports_rounded,
  'home': Icons.home_rounded,
  'key': Icons.key_rounded,
  'box': Icons.inventory_2_outlined,
  'layers': Icons.layers_rounded,
  'sparkles': Icons.auto_awesome_rounded,
  'gift': Icons.card_giftcard_rounded,
  'printer': Icons.print_rounded,
  'heart': Icons.favorite_rounded,
  'star': Icons.star_rounded,
  'tag': Icons.sell_rounded,
  'palette': Icons.palette_rounded,
  'bolt': Icons.bolt_rounded,
  'zap': Icons.flash_on_rounded,
};

/// Ícono de una categoría (si no se conoce, la caja de la web).
IconData categoryIconData(String? name) =>
    kCategoryIcons[name] ?? kCategoryIcons['box']!;

/// Nombre en castellano de cada ícono: es lo que lee el lector de pantalla y lo
/// que aparece al mantener apretada la casilla (antes salía la clave interna
/// en inglés: "lamp", "cpu", "zap"…).
const Map<String, String> kCategoryIconLabels = {
  'lamp': 'Lámpara',
  'cpu': 'Chip',
  'gamepad': 'Joystick',
  'home': 'Casa',
  'key': 'Llave',
  'box': 'Caja',
  'layers': 'Capas',
  'sparkles': 'Brillos',
  'gift': 'Regalo',
  'printer': 'Impresora',
  'heart': 'Corazón',
  'star': 'Estrella',
  'tag': 'Etiqueta',
  'palette': 'Paleta',
  'bolt': 'Rayo',
  'zap': 'Relámpago',
};

/// Los colores que ofrece la web (en este orden).
const List<String> kCategoryColors = [
  '#C9A84C',
  '#5A9CD9',
  '#9B7BD4',
  '#4CB782',
  '#D98A5A',
  '#D96A5A',
  '#D9A441',
  '#5ED29A',
];

/// Nombre en castellano de cada color (antes la casilla se anunciaba con su
/// código: "#C9A84C").
const Map<String, String> kCategoryColorLabels = {
  '#C9A84C': 'Dorado',
  '#5A9CD9': 'Azul',
  '#9B7BD4': 'Violeta',
  '#4CB782': 'Verde',
  '#D98A5A': 'Naranja',
  '#D96A5A': 'Rojo',
  '#D9A441': 'Ámbar',
  '#5ED29A': 'Verde claro',
};
