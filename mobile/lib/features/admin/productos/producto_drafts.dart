// Borradores LOCALES del formulario de producto (sin widgets): lo que la
// persona venía cargando y todavía no guardó. Pedido del operador: "a veces
// cierro sin querer y debo de empezar el procedimiento todo de nuevo".
//
// Se guardan solo en el teléfono (no viajan al servidor). No confundir con el
// ESTADO "Borrador" de un producto ya creado ([ProductState.draft]).
//
// Todo acá es puro: se prueba sin dibujar nada. Lo que no se entiende al leer
// (datos viejos, rotos o de otra versión) se ignora; nunca lanza.

import 'dart:convert';

import 'producto_form_logic.dart';

/// Versión del formato guardado. Si cambia de forma incompatible, se sube y lo
/// anterior se descarta al leer.
const int kProductDraftsVersion = 1;

/// Tope de borradores de productos nuevos (y, aparte, de ediciones a medias).
const int kMaxProductDrafts = 10;

String _str(dynamic v) => v is String ? v : '';
String? _strOrNull(dynamic v) => (v is String && v.trim().isNotEmpty) ? v : null;

/// Lo que hay escrito en el formulario, TAL CUAL (los números como texto: así
/// al recuperar se ve lo mismo que se había tipeado, aunque esté a medias).
class ProductDraftFields {
  const ProductDraftFields({
    this.name = '',
    this.description = '',
    this.categoryId,
    this.categoryLabel,
    this.material,
    this.priceText = '',
    this.saleText = '',
    this.weightText = '',
    this.minutesText = '',
    this.dimensions = '',
    this.productionTime = '',
    this.featured = false,
  });

  final String name;
  final String description;
  final String? categoryId;

  /// Ruta de la categoría ("Figuras › Funko Pop"), para mostrarla sin pedirla.
  final String? categoryLabel;
  final String? material;
  final String priceText;
  final String saleText;
  final String weightText;
  final String minutesText;
  final String dimensions;
  final String productionTime;
  final bool featured;

  /// Los mismos datos, interpretados como los usa el formulario.
  ProductFormValues toValues() => ProductFormValues.fromRaw(
        name: name,
        description: description,
        categoryId: categoryId,
        material: material,
        priceText: priceText,
        saleText: saleText,
        weightText: weightText,
        minutesText: minutesText,
        dimensions: dimensions,
        productionTime: productionTime,
        featured: featured,
      );

  /// No hay nada cargado (un alta sin tocar): no vale la pena guardarlo.
  bool get isBlank =>
      name.trim().isEmpty &&
      description.trim().isEmpty &&
      categoryId == null &&
      (material == null || material!.trim().isEmpty) &&
      priceText.trim().isEmpty &&
      saleText.trim().isEmpty &&
      weightText.trim().isEmpty &&
      minutesText.trim().isEmpty &&
      dimensions.trim().isEmpty &&
      productionTime.trim().isEmpty &&
      !featured;

  Map<String, dynamic> toJson() => {
        'name': name,
        'description': description,
        'categoryId': categoryId,
        'categoryLabel': categoryLabel,
        'material': material,
        'price': priceText,
        'sale': saleText,
        'weight': weightText,
        'minutes': minutesText,
        'dimensions': dimensions,
        'productionTime': productionTime,
        'featured': featured,
      };

  factory ProductDraftFields.fromJson(Map<String, dynamic> j) => ProductDraftFields(
        name: _str(j['name']),
        description: _str(j['description']),
        categoryId: _strOrNull(j['categoryId']),
        categoryLabel: _strOrNull(j['categoryLabel']),
        material: _strOrNull(j['material']),
        priceText: _str(j['price']),
        saleText: _str(j['sale']),
        weightText: _str(j['weight']),
        minutesText: _str(j['minutes']),
        dimensions: _str(j['dimensions']),
        productionTime: _str(j['productionTime']),
        featured: j['featured'] == true,
      );

  @override
  bool operator ==(Object other) =>
      other is ProductDraftFields &&
      other.name == name &&
      other.description == description &&
      other.categoryId == categoryId &&
      other.categoryLabel == categoryLabel &&
      other.material == material &&
      other.priceText == priceText &&
      other.saleText == saleText &&
      other.weightText == weightText &&
      other.minutesText == minutesText &&
      other.dimensions == dimensions &&
      other.productionTime == productionTime &&
      other.featured == featured;

  @override
  int get hashCode => Object.hash(name, description, categoryId, categoryLabel, material, priceText,
      saleText, weightText, minutesText, dimensions, productionTime, featured);
}

/// Un borrador guardado. Con [productId] es una EDICIÓN a medias de ese
/// producto; sin él, un producto nuevo que todavía no se creó.
class ProductDraft {
  const ProductDraft({
    required this.id,
    required this.updatedAt,
    required this.fields,
    this.productId,
    this.productUpdatedAt,
  });

  final String id;
  final DateTime updatedAt;
  final ProductDraftFields fields;
  final String? productId;

  /// Edición: cuándo se había modificado el producto al empezar a editarlo. Si
  /// al recuperar ya no coincide, alguien lo cambió en el medio y se avisa.
  final String? productUpdatedAt;

  /// Nombre para la lista de borradores.
  String get title => fields.name.trim().isEmpty ? 'Producto sin nombre' : fields.name.trim();

  Map<String, dynamic> toJson() => {
        'id': id,
        'updatedAt': updatedAt.toUtc().toIso8601String(),
        'productId': ?productId,
        'productUpdatedAt': ?productUpdatedAt,
        'fields': fields.toJson(),
      };

  /// `null` si el dato no sirve (sin id, sin fecha o sin campos).
  static ProductDraft? fromJson(dynamic j) {
    if (j is! Map) return null;
    final id = _strOrNull(j['id']);
    final at = DateTime.tryParse(_str(j['updatedAt']));
    final fields = j['fields'];
    if (id == null || at == null || fields is! Map) return null;
    try {
      return ProductDraft(
        id: id,
        updatedAt: at.toLocal(),
        fields: ProductDraftFields.fromJson(Map<String, dynamic>.from(fields)),
        productId: _strOrNull(j['productId']),
        productUpdatedAt: _strOrNull(j['productUpdatedAt']),
      );
    } catch (_) {
      return null;
    }
  }
}

/// Todos los borradores del teléfono. Inmutable: cada cambio devuelve otro.
class ProductDraftBook {
  const ProductDraftBook({this.drafts = const [], this.edits = const []});

  /// Productos nuevos sin terminar, del más reciente al más viejo.
  final List<ProductDraft> drafts;

  /// Ediciones a medias (una por producto), de la más reciente a la más vieja.
  final List<ProductDraft> edits;

  static const empty = ProductDraftBook();

  ProductDraft? byId(String id) => drafts.where((d) => d.id == id).firstOrNull;
  ProductDraft? editOf(String productId) => edits.where((d) => d.productId == productId).firstOrNull;

  /// Guarda (o actualiza) un borrador de producto nuevo: queda primero. Con
  /// más de [kMaxProductDrafts] se cae el más viejo.
  ProductDraftBook save(ProductDraft draft) => ProductDraftBook(
        drafts: _capped([draft, ...drafts.where((d) => d.id != draft.id)]),
        edits: edits,
      );

  ProductDraftBook remove(String id) =>
      ProductDraftBook(drafts: drafts.where((d) => d.id != id).toList(), edits: edits);

  /// Guarda la edición a medias de un producto (reemplaza la anterior).
  ProductDraftBook saveEdit(ProductDraft draft) {
    final productId = draft.productId;
    if (productId == null) return this;
    return ProductDraftBook(
      drafts: drafts,
      edits: _capped([draft, ...edits.where((d) => d.productId != productId)]),
    );
  }

  ProductDraftBook removeEdit(String productId) =>
      ProductDraftBook(drafts: drafts, edits: edits.where((d) => d.productId != productId).toList());

  static List<ProductDraft> _capped(List<ProductDraft> list) {
    final sorted = [...list]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return sorted.take(kMaxProductDrafts).toList();
  }

  Map<String, dynamic> toJson() => {
        'version': kProductDraftsVersion,
        'drafts': [for (final d in drafts) d.toJson()],
        'edits': [for (final d in edits) d.toJson()],
      };

  String encode() => jsonEncode(toJson());

  /// Lee lo guardado. Texto vacío, roto, de otra versión o con entradas
  /// inválidas: se ignora lo que no sirve (en el peor caso, queda vacío).
  static ProductDraftBook decode(String? raw) {
    if (raw == null || raw.trim().isEmpty) return empty;
    try {
      final json = jsonDecode(raw);
      if (json is! Map || json['version'] != kProductDraftsVersion) return empty;
      List<ProductDraft> read(dynamic v, {required bool edit}) {
        final seen = <String>{};
        final out = <ProductDraft>[];
        for (final e in v is List ? v : const []) {
          final d = ProductDraft.fromJson(e);
          if (d == null || (d.productId != null) != edit) continue;
          if (!seen.add(edit ? d.productId! : d.id)) continue;
          out.add(d);
        }
        return _capped(out);
      }

      return ProductDraftBook(
        drafts: read(json['drafts'], edit: false),
        edits: read(json['edits'], edit: true),
      );
    } catch (_) {
      return empty;
    }
  }
}

/// "recién", "hace 5 min", "hace 3 h", "ayer" o la fecha ("el 12/10/2026").
String draftAgo(DateTime at, DateTime now) {
  final diff = now.difference(at);
  if (diff.inMinutes < 1) return 'recién';
  if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
  if (diff.inHours < 24) return 'hace ${diff.inHours} h';
  if (diff.inHours < 48) return 'ayer';
  String two(int n) => n.toString().padLeft(2, '0');
  return 'el ${two(at.day)}/${two(at.month)}/${at.year}';
}
