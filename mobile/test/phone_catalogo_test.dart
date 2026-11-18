// Catálogo del panel (Productos y Categorías) en "teléfono real"
// (2026-11-14, pedido de Ale: "que las pantallas no estén rotas, que cuando
// tocás los botones se vean bien los modales").
//
// Cada pantalla, cada formulario con el teclado abierto y CADA modal (hojas,
// diálogos, menús) se dibujan en el teléfono más chico (Android de 360×640 con
// los tres botones) y en un iPhone con notch, abriéndolos por el camino real
// (tocando el botón de la pantalla). Falla si algo se desborda, si un campo
// queda tapado por el teclado, si un botón queda debajo de la barra del sistema
// o si una hoja se mete debajo de la barra de estado.
// Con SHOT_DIR=carpeta guarda una captura de cada estado para mirarlo.

import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/core/widgets/photo_picker.dart';
import 'package:hefesto/features/admin/categorias/categoria_form_screen.dart';
import 'package:hefesto/features/admin/categorias/categorias_models.dart';
import 'package:hefesto/features/admin/categorias/categorias_providers.dart';
import 'package:hefesto/features/admin/categorias/categorias_screen.dart';
import 'package:hefesto/features/admin/productos/producto_detail_screen.dart';
import 'package:hefesto/features/admin/productos/producto_form_screen.dart';
import 'package:hefesto/features/admin/productos/productos_models.dart';
import 'package:hefesto/features/admin/productos/productos_providers.dart';
import 'package:hefesto/features/admin/productos/productos_screen.dart';

import 'support/device_kit.dart';
import 'support/photo_kit.dart';

// ---------------------------------------------------------------------------
// Datos de ejemplo (misma forma que manda el servidor: ver admin-api.ts)
// ---------------------------------------------------------------------------

const _longName =
    'Tony Tony Chopper Tamaño Real con base personalizada, luces LED y un nombre larguísimo para probar el recorte';

Map<String, dynamic> _row(
  String id,
  String name, {
  String status = 'published',
  num price = 30000,
  num? sale,
  bool featured = false,
  bool isNew = false,
  int images = 2,
  int variants = 0,
  String? category = 'Mates',
  String? material = 'PLA',
}) =>
    {
      'id': id,
      'name': name,
      'slug': id,
      'status': status,
      'price': price,
      'salePrice': sale,
      'isOnSale': sale != null,
      'discountPercent': sale == null ? null : ((1 - sale / price) * 100).round(),
      'isFeatured': featured,
      'isNew': isNew,
      'material': material,
      'categoryId': 'c1',
      'categoryName': category,
      'imageUrl': null,
      'imagePosition': null,
      'imageCount': images,
      'variantCount': variants,
      'updatedAt': '2026-10-31T12:00:00.000Z',
      'createdAt': '2026-10-01T12:00:00.000Z',
    };

/// Listado con un poco de todo: oferta, nombre larguísimo con montos de 9
/// cifras, borrador sin fotos, archivado sin categoría y una fila casi vacía.
final _page = AdminProductsPage.fromJson({
  'items': [
    _row('p1', 'Mate Mario', sale: 24000, featured: true, isNew: true),
    _row('p2', _longName,
        price: 123456789,
        sale: 98765432,
        featured: true,
        isNew: true,
        variants: 12,
        images: 0,
        category: 'Superhéroes de Marvel y DC Comics edición limitada para coleccionistas',
        material: 'PLA+ Silk Tricolor Premium'),
    _row('p3', 'Cartel Personalizado', status: 'draft', price: 32500, images: 0, material: null),
    _row('p4', 'Llavero Nombre', status: 'archived', price: 4500, category: null),
    // Lo mínimo que podría mandar el servidor: el resto llega null.
    {'id': 'p5', 'status': 'draft'},
  ],
  'total': 57,
  'page': 1,
  'pageSize': 40,
  'totalPages': 2,
  'counts': {'total': 57, 'published': 40, 'draft': 12, 'archived': 5, 'featured': 6, 'onSale': 3},
});

AdminProductsPage _bigPage(int shown, int total) => AdminProductsPage.fromJson({
      'items': [
        for (var i = 1; i <= shown; i++)
          _row('n$i', 'Producto número $i', price: 1000 * i, variants: i % 3, isNew: i.isEven),
      ],
      'total': total,
      'counts': {'total': total, 'published': total, 'draft': 0, 'archived': 0},
    });

final _emptyPage = AdminProductsPage.fromJson({'items': <dynamic>[], 'total': 0, 'counts': <String, dynamic>{}});

Map<String, dynamic> _detailJson() => {
      'id': 'p1',
      'name': 'Mate Mario',
      'slug': 'mate-mario',
      'description': 'Un mate para los fanáticos de Mario, impreso en PLA de alta calidad.',
      'status': 'published',
      'isFeatured': true,
      'isNew': true,
      'updatedAt': '2026-10-31T12:00:00.000Z',
      'categoryId': 'c-kid',
      'categoryName': 'Funko Pop',
      'categoryPath': 'Figuras de colección › Funko Pop',
      'price': '30000.00',
      'salePrice': 24000,
      'isOnSale': true,
      'discountPercent': 20,
      'priceMin': 20000,
      'priceMax': 38000,
      'priceFrom': true,
      'material': 'PLA',
      'printTimeMinutes': 330,
      'weightGrams': 120,
      'dimensions': '12 cm de alto',
      'layerHeight': '0.2 mm',
      'infillPercent': 15,
      'productionTime': '3 a 5 días hábiles',
      'colorMode': 'single',
      'colors': ['Rojo', 'Negro', 'Verde militar'],
      'colorPrices': {'Rojo': 31000, 'Negro': 30000},
      'variants': [
        {'label': 'Chico 10 cm', 'price': 20000, 'colorGrams': {}, 'weightGrams': 80, 'colorPrices': {}, 'extrasCost': 300},
        {'label': 'Grande 15 cm', 'price': 35000, 'colorGrams': {}, 'weightGrams': 160, 'colorPrices': {'Rojo': 38000}},
      ],
      'images': [
        {'id': 'i1', 'url': '', 'isPrimary': true, 'color': null, 'position': '50% 50%'},
        {'id': 'i2', 'url': '', 'isPrimary': false, 'color': 'Rojo', 'position': '50% 50%'},
        {'id': 'i3', 'url': '', 'isPrimary': false, 'color': null, 'position': '50% 50%'},
      ],
      'costs': {'amortization': 8000, 'profit': 22000, 'extrasCost': 500},
    };

final _detail = AdminProductDetail.fromJson(_detailJson());

/// Borrador recién creado desde la app: sin fotos, sin colores, sin costos.
final _draftDetail = AdminProductDetail.fromJson({
  ..._detailJson(),
  'id': 'p3',
  'name': 'Cartel Personalizado',
  'slug': 'cartel',
  'status': 'draft',
  'isFeatured': false,
  'isNew': false,
  'salePrice': null,
  'isOnSale': false,
  'discountPercent': null,
  'priceMin': 30000,
  'priceMax': 30000,
  'priceFrom': false,
  'colors': <dynamic>[],
  'colorPrices': <String, dynamic>{},
  'variants': <dynamic>[],
  'images': <dynamic>[],
  'costs': null,
});

/// Todo al límite: nombre de 108 letras, montos de 9 cifras, muchos colores y
/// tamaños con nombres largos, 8 fotos y una descripción de 2000 letras.
final _extremeDetail = AdminProductDetail.fromJson({
  ..._detailJson(),
  'id': 'p2',
  'name': _longName,
  'description': List.filled(40, 'Impreso en PLA de alta calidad, pintado a mano y con terminación mate.')
      .join(' ')
      .substring(0, 2000),
  'categoryName': 'Superhéroes de Marvel y DC Comics edición limitada',
  'categoryPath':
      'Figuras de colección para regalar › Funko Pop y muñecos articulados › Superhéroes de Marvel y DC Comics edición limitada',
  'price': 123456789,
  'salePrice': 98765432,
  'discountPercent': 20,
  'priceMin': 98765432,
  'priceMax': 987654321,
  'material': 'PLA+ Silk Tricolor Premium de alta resistencia',
  'printTimeMinutes': 99999,
  'weightGrams': 123456,
  'dimensions': '120 cm de alto × 85 cm de ancho × 60 cm de profundidad (se entrega desarmado en 14 piezas)',
  'productionTime': 'Entre 25 y 40 días hábiles según la demanda del taller y la disponibilidad de filamento',
  'layerHeight': '0.12 mm (calidad ultra fina)',
  'colors': [
    for (final c in ['Rojo fuego metalizado', 'Negro mate', 'Verde militar', 'Azul Francia', 'Blanco perla', 'Dorado'])
      c,
    for (var i = 1; i <= 8; i++) 'Color especial número $i',
  ],
  'colorPrices': {'Rojo fuego metalizado': 123456789, 'Negro mate': 120000000, 'Dorado': 987654321},
  'variants': [
    for (var i = 1; i <= 6; i++)
      {
        'label': 'Tamaño $i: ${i * 20} cm de alto con base iluminada y caja de regalo premium',
        'price': i.isEven ? 123456789 * i : null,
        'colorGrams': <String, dynamic>{},
        'weightGrams': 1234.5 * i,
        'colorPrices': {'Rojo fuego metalizado': 223456789, 'Negro mate': 198765432, 'Dorado': 987654321},
        'extrasCost': 123456,
      },
  ],
  'images': [
    for (var i = 1; i <= 8; i++)
      {
        'id': 'i$i',
        'url': '',
        'isPrimary': i == 1,
        'color': i == 1 ? 'Rojo fuego metalizado con detalles en dorado' : null,
        'position': '50% 50%',
      },
  ],
  'costs': {'amortization': 123456789, 'profit': 987654321, 'extrasCost': 123456789},
});

/// Lo mínimo: todo lo opcional en null.
final _bareDetail = AdminProductDetail.fromJson({'id': 'p5', 'status': 'draft'});

Map<String, dynamic> _opt(String id, String name, {String? parentId, int depth = 0, String? path}) =>
    {'id': id, 'name': name, 'parentId': parentId, 'depth': depth, 'path': path ?? name};

final _options = ProductOptions.fromJson({
  'categories': [
    _opt('f', 'Figuras de colección'),
    _opt('c-kid', 'Funko Pop', parentId: 'f', depth: 1, path: 'Figuras de colección › Funko Pop'),
    _opt('c1', 'Carteles'),
  ],
  'materials': ['PETG', 'PLA'],
});

/// 40 categorías (con cinco niveles y nombres largos) y 35 materiales.
final _manyOptions = ProductOptions.fromJson({
  'categories': [
    for (var i = 1; i <= 8; i++) ...[
      _opt('r$i', 'Categoría principal número $i con un nombre bastante largo para el celular'),
      _opt('r$i-a', 'Subcategoría A de la $i',
          parentId: 'r$i', depth: 1, path: 'Categoría principal número $i › Subcategoría A de la $i'),
      _opt('r$i-b', 'Nivel tres con otro nombre largo que no entra en una sola línea',
          parentId: 'r$i-a',
          depth: 2,
          path: 'Categoría principal número $i › Subcategoría A de la $i › Nivel tres con otro nombre largo'),
      _opt('r$i-c', 'Nivel cuatro',
          parentId: 'r$i-b', depth: 3, path: 'Categoría $i › Subcategoría A › Nivel tres › Nivel cuatro'),
      _opt('r$i-d', 'Nivel cinco (el más profundo)',
          parentId: 'r$i-c', depth: 4, path: 'Categoría $i › Subcategoría A › Nivel tres › Nivel cuatro › Nivel cinco'),
    ],
  ],
  'materials': [
    for (var i = 1; i <= 35; i++) 'Material especial número $i con nombre largo',
  ],
});

Map<String, dynamic> _cat(
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
}) =>
    {
      'id': id,
      'name': name,
      'slug': id,
      'icon': icon,
      'color': color,
      'imageUrl': null,
      'sortOrder': 0,
      'parentId': parentId,
      'depth': depth,
      'path': path ?? name,
      'productCount': products,
      'totalProductCount': total,
      'childCount': children,
      'descendantCount': descendants,
    };

final _cats = AdminCategoriesData.fromJson({
  'items': [
    _cat('f', 'Figuras de colección', products: 2, total: 9, children: 2, descendants: 3, icon: 'star', color: '#9B7BD4'),
    _cat('fp', 'Funko Pop',
        parentId: 'f',
        depth: 1,
        path: 'Figuras de colección › Funko Pop',
        products: 3,
        total: 7,
        children: 1,
        descendants: 1,
        icon: 'gamepad'),
    _cat('sh', 'Superhéroes',
        parentId: 'fp', depth: 2, path: 'Figuras de colección › Funko Pop › Superhéroes', products: 4, total: 4),
    _cat('an', 'Anime', parentId: 'f', depth: 1, path: 'Figuras de colección › Anime'),
    _cat('l', 'Llaveros', products: 5, total: 5, icon: 'key', color: '#5A9CD9'),
    _cat('d', 'Decoración y hogar para toda la familia con un nombre bien largo',
        products: 1, total: 1, icon: 'home', color: '#4CB782'),
    _cat('m', 'Mates', icon: null, color: null),
  ],
  'summary': {'total': 7, 'roots': 4, 'subcategories': 3, 'productsCategorized': 12},
});

/// 40 categorías: 8 principales, cada una con una cadena de 4 subniveles, con
/// nombres largos y contadores de 9 cifras.
final _manyCats = AdminCategoriesData.fromJson({
  'items': [
    for (var i = 1; i <= 8; i++) ...[
      _cat('r$i', 'Categoría principal número $i con un nombre bastante largo para el celular',
          products: 123456789, total: 987654321, children: 1, descendants: 4, icon: 'star'),
      _cat('r$i-a', 'Subcategoría A de la $i con nombre largo',
          parentId: 'r$i',
          depth: 1,
          path: 'Categoría principal número $i › Subcategoría A de la $i',
          total: 12,
          children: 1,
          descendants: 3),
      _cat('r$i-b', 'Nivel tres con otro nombre largo que no entra en una sola línea',
          parentId: 'r$i-a',
          depth: 2,
          path: 'Categoría principal número $i › Subcategoría A de la $i › Nivel tres',
          total: 8,
          children: 1,
          descendants: 2),
      _cat('r$i-c', 'Nivel cuatro',
          parentId: 'r$i-b', depth: 3, path: 'Categoría $i › Sub A › Nivel tres › Nivel cuatro', total: 3, children: 1, descendants: 1),
      _cat('r$i-d', 'Nivel cinco (el más profundo de todos los niveles)',
          parentId: 'r$i-c', depth: 4, path: 'Categoría $i › Sub A › Nivel tres › Nivel cuatro › Nivel cinco', products: 3, total: 3),
    ],
  ],
  'summary': {'total': 40, 'roots': 8, 'subcategories': 32, 'productsCategorized': 987654321},
});

final _emptyCats = AdminCategoriesData.fromJson({'items': <dynamic>[]});

// ---------------------------------------------------------------------------
// Repos falsos (sin red)
// ---------------------------------------------------------------------------

class FakeProductosRepo extends ProductosRepo {
  FakeProductosRepo({this.failWith, this.gate}) : super(ApiClient());

  /// Si no es null, las escrituras fallan con este mensaje del servidor.
  final String? failWith;

  /// Si no es null, las escrituras esperan a que se complete (para probar el
  /// doble toque mientras se guarda).
  final Completer<void>? gate;

  final calls = <String>[];
  Map<String, dynamic>? lastPatch;
  Map<String, dynamic>? lastCreate;

  Future<void> _run(String call) async {
    calls.add(call);
    if (gate != null) await gate!.future;
    if (failWith != null) throw ApiException('invalid', failWith!, status: 422);
  }

  @override
  Future<void> setFeatured(String id, bool value) => _run('featured:$id:$value');
  @override
  Future<void> setStatus(String id, ProductState status) => _run('status:$id:${status.api}');
  @override
  Future<void> delete(String id) => _run('delete:$id');
  @override
  Future<void> setPrimaryImage(String id, String imageId) => _run('primary:$id:$imageId');
  @override
  Future<String> addImage(String id, PickedPhoto photo, {String? color}) async {
    await _run('image:$id:${photo.filename}:${color ?? '-'}');
    return 'img-${calls.length}';
  }

  @override
  Future<void> deleteImage(String id, String imageId) => _run('image_delete:$id:$imageId');
  @override
  Future<void> patch(String id, Map<String, dynamic> body) async {
    lastPatch = body;
    await _run('patch:$id');
  }

  @override
  Future<String> create(Map<String, dynamic> body) async {
    lastCreate = body;
    await _run('create');
    return 'nuevo-id';
  }
}

class FakeCategoriasRepo extends CategoriasRepo {
  FakeCategoriasRepo({this.failWith}) : super(ApiClient());
  final String? failWith;
  final calls = <String>[];
  Map<String, dynamic>? lastBody;

  Future<void> _run(String call) async {
    calls.add(call);
    if (failWith != null) throw ApiException('invalid', failWith!, status: 422);
  }

  @override
  Future<String> create(Map<String, dynamic> body) async {
    lastBody = body;
    await _run('create');
    return 'nueva';
  }

  @override
  Future<void> update(String id, Map<String, dynamic> body) async {
    lastBody = body;
    await _run('update:$id');
  }

  @override
  Future<void> delete(String id) => _run('delete:$id');
}

/// El mensaje más largo que manda el servidor al guardar un producto.
const _serverCostError =
    'No pudimos calcular el costo de producción. Elegí un material que tenga filamento cargado e indicá los gramos y el tiempo de impresión.';

List<Override> _prod({
  AdminProductsPage? page,
  AdminProductDetail? detail,
  ProductOptions? options,
  FakeProductosRepo? repo,
  PhotoSource? photos,
}) =>
    [
      adminProductsProvider.overrideWith((ref, f) async => page ?? _page),
      adminProductProvider.overrideWith((ref, id) async => detail ?? _detail),
      adminProductOptionsProvider.overrideWith((ref) async => options ?? _options),
      productosRepoProvider.overrideWithValue(repo ?? FakeProductosRepo()),
      photoSourceProvider.overrideWithValue(photos ?? FakePhotoSource()),
    ];

List<Override> _catOv({AdminCategoriesData? data, FakeCategoriasRepo? repo}) => [
      adminCategoriesProvider.overrideWith((ref) async => data ?? _cats),
      categoriasRepoProvider.overrideWithValue(repo ?? FakeCategoriasRepo()),
    ];

final _admin = staffWith(['productos', 'ganancias']);

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

/// La lista principal de la pantalla (no el desplazable interno de un campo).
Finder _mainList() =>
    find.descendant(of: find.byType(RefreshIndicator), matching: find.byType(Scrollable)).first;

/// Lleva [finder] a la vista dentro de [scrollable]. Las listas largas arman
/// sus filas a medida que se desplazan: lo que está lejos todavía no existe.
Future<void> _reveal(WidgetTester tester, Finder finder, Finder scrollable) async {
  final pos = tester.state<ScrollableState>(scrollable).position;
  if (finder.evaluate().isEmpty) {
    pos.jumpTo(0);
    await tester.pump(const Duration(milliseconds: 50));
    var guard = 0;
    while (finder.evaluate().isEmpty && pos.pixels < pos.maxScrollExtent - 0.5 && guard++ < 200) {
      pos.jumpTo((pos.pixels + 150).clamp(0.0, pos.maxScrollExtent));
      await tester.pump(const Duration(milliseconds: 50));
    }
  }
  await tester.ensureVisible(finder.first);
  await tester.pump(const Duration(milliseconds: 50));
}

Finder get _sheet => find.byType(BottomSheet);
Finder _inSheet(Finder f) => find.descendant(of: _sheet, matching: f);

/// La manija de arrastre de una hoja (es la forma de cerrarla a mano).
Finder get _dragHandle => find.byWidgetPredicate((w) => '${w.runtimeType}' == '_DragHandle');

/// El panel de un diálogo (no su barrera, que ocupa toda la pantalla).
Finder get _dialogPanel => find.descendant(of: find.byType(Dialog), matching: find.byType(Material)).first;

/// Toca fuera del modal (arriba, sobre la barrera) para cerrarlo.
Future<void> _tapOutside(WidgetTester tester) async {
  await tester.tapAt(Offset(currentPhone.width / 2, 3));
  await settle(tester, 5);
}

/// Una hoja abierta tiene que: no lanzar, tener título, quedar debajo de la
/// barra de estado y dejar a mano su manija (cerrar).
void _expectSheetOk(WidgetTester tester, String title) {
  expectNoLayoutErrors(tester, 'con la hoja "$title" abierta');
  expect(_sheet, findsOneWidget, reason: 'tendría que haber una hoja abierta ("$title")');
  expectReachable(tester, _inSheet(find.text(title)), what: 'el título de la hoja "$title"');
  expectReachable(tester, _dragHandle, what: 'la manija para cerrar la hoja "$title"');
  expect(
    tester.getRect(_sheet).top >= currentPhone.top - 0.5,
    isTrue,
    reason: 'la hoja "$title" se mete debajo de la barra de estado en ${currentPhone.name}',
  );
}

/// Un diálogo de confirmación: entra entero en la zona visible y sus dos
/// botones (confirmar y cancelar) se pueden tocar.
void _expectDialogOk(WidgetTester tester, {required String confirm, String? cancel = 'Cancelar'}) {
  expectNoLayoutErrors(tester, 'con el diálogo "$confirm" abierto');
  expect(find.byType(Dialog), findsOneWidget, reason: 'tendría que haber un diálogo abierto (con "$confirm")');
  expectReachable(tester, _dialogPanel, what: 'el diálogo');
  expectReachable(tester, find.widgetWithText(TextButton, confirm), what: 'el botón "$confirm"');
  if (cancel != null) {
    expectReachable(tester, find.widgetWithText(TextButton, cancel), what: 'el botón "$cancel"');
  }
}

/// Lo que se ve de [finder] dentro de la zona visible (para "¿se llega a leer?").
bool _isOnScreen(WidgetTester tester, Finder finder) {
  if (finder.evaluate().isEmpty) return false;
  final r = tester.getRect(finder.first);
  final v = safeRect;
  return r.top >= v.top - 0.5 && r.bottom <= v.bottom + 0.5;
}

Future<void> _tap(WidgetTester tester, Finder finder, {int frames = 6}) async {
  await tester.tap(finder);
  await settle(tester, frames);
}

/// Abre el menú "⋮" de la fila que contiene [text].
Future<void> _openRowMenu(WidgetTester tester, String text) async {
  await _reveal(tester, find.text(text), _mainList());
  final card = find.ancestor(of: find.text(text), matching: find.byType(InkWell)).first;
  final more = find.descendant(of: card, matching: find.byIcon(Icons.more_vert_rounded));
  await _reveal(tester, more, _mainList());
  await _tap(tester, more);
}

void main() {
  setUpAll(setUpDeviceKit);

  // =========================================================================
  // PRODUCTOS · LISTADO
  // =========================================================================
  group('Productos · listado', () {
    for (final phone in Phone.both) {
      testWidgets('se dibuja, llega al final y nada queda bajo las barras (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod());
        expectReachable(tester, find.text('Productos'), what: 'el título');
        expectReachable(tester, find.byType(FloatingActionButton), what: 'el botón "Nuevo"');
        expect(find.text('Todos (57)'), findsOneWidget);
        await shoot(tester, 'prod_lista');

        await scrollToEnd(tester, scrollable: _mainList());
        expectReachable(tester, find.text('Ver más (52 restantes)'), what: 'el botón "Ver más"');
        // El botón flotante no puede tapar lo último de la lista.
        final fab = tester.getRect(find.byType(FloatingActionButton));
        final more = tester.getRect(find.text('Ver más (52 restantes)'));
        expect(more.bottom <= fab.top || more.right <= fab.left, isTrue,
            reason: 'el botón flotante tapa "Ver más"');
        await shoot(tester, 'prod_lista_fin');
      });

      testWidgets('los filtros de arriba se pueden tocar con el dedo (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod());
        for (final label in ['Todos (57)', 'Activos (40)', 'Categoría', 'Destacados']) {
          final chip = find.ancestor(of: find.text(label), matching: find.byType(RawChip)).first;
          expect(tester.getSize(chip).height >= 44, isTrue,
              reason: 'el filtro "$label" mide ${tester.getSize(chip).height} dp de alto: cuesta acertarle');
        }
        // Tocar un filtro lo deja elegido (y la fila de filtros no se rompe).
        await _tap(tester, find.text('En oferta'));
        await _tap(tester, find.text('Borradores (12)'));
        expectNoLayoutErrors(tester);
        await shoot(tester, 'prod_lista_filtros');

        // Buscar: el campo queda a la vista con el teclado abierto y el botón
        // flotante no tapa los resultados (que ahí son apenas un renglón).
        await openKeyboard(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        expect(find.byType(FloatingActionButton), findsNothing,
            reason: 'con el teclado abierto el botón flotante quedaba encima de los resultados');
        await shoot(tester, 'prod_lista_buscar_teclado');
        await closeKeyboard(tester);
        expectReachable(tester, find.byType(FloatingActionButton), what: 'el botón "Nuevo" al cerrar el teclado');
      });

      testWidgets('menú de orden (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod());
        await _tap(tester, find.byTooltip('Ordenar'));
        expectNoLayoutErrors(tester);
        for (final o in [
          'Modificados hace poco',
          'Más nuevos',
          'Nombre (A-Z)',
          'Precio: menor a mayor',
          'Precio: mayor a menor',
        ]) {
          expectReachable(tester, find.text(o), what: 'la opción "$o"');
        }
        await shoot(tester, 'prod_menu_orden');
        await _tap(tester, find.text('Precio: mayor a menor'));
        expect(find.text('Precio: menor a mayor'), findsNothing, reason: 'el menú se cierra al elegir');
        expectNoLayoutErrors(tester);
      });

      testWidgets('menú de la fila: arriba y en la última fila (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod());
        await _openRowMenu(tester, 'Mate Mario');
        for (final o in ['Quitar de destacados', 'Archivar', 'Eliminar']) {
          expectReachable(tester, find.text(o), what: 'la opción "$o"');
        }
        await shoot(tester, 'prod_menu_fila');
        await _tapOutside(tester);
        expect(find.text('Quitar de destacados'), findsNothing);

        // La última fila queda pegada al borde de abajo: el menú no puede
        // abrirse debajo de la barra del sistema.
        await scrollToEnd(tester, scrollable: _mainList());
        await _openRowMenu(tester, 'Sin nombre');
        for (final o in ['Destacar', 'Publicar', 'Archivar', 'Eliminar']) {
          expectReachable(tester, find.text(o), what: 'la opción "$o" (última fila)');
        }
        await shoot(tester, 'prod_menu_fila_ultima');
      });

      testWidgets('archivar pide confirmación (${phone.name})', (tester) async {
        final repo = FakeProductosRepo();
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod(repo: repo));
        await _openRowMenu(tester, 'Mate Mario');
        await _tap(tester, find.text('Archivar'));
        expect(find.text('¿Archivar "Mate Mario"?'), findsOneWidget);
        _expectDialogOk(tester, confirm: 'Archivar');
        await shoot(tester, 'prod_dialogo_archivar');
        await _tap(tester, find.widgetWithText(TextButton, 'Archivar'));
        expect(repo.calls, ['status:p1:archived']);
        expect(find.text('Producto archivado'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'prod_aviso_archivado');
      });

      testWidgets('eliminar un producto de nombre larguísimo: el diálogo entra entero (${phone.name})', (tester) async {
        final repo = FakeProductosRepo();
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod(repo: repo));
        await _openRowMenu(tester, _longName);
        await _tap(tester, find.text('Eliminar'));
        _expectDialogOk(tester, confirm: 'Eliminar para siempre');
        expect(find.textContaining('conservan su registro'), findsOneWidget);
        await shoot(tester, 'prod_dialogo_eliminar');
        await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));
        expect(repo.calls, isEmpty, reason: 'cancelar no borra');
      });

      testWidgets('un error del servidor en una acción rápida se avisa (${phone.name})', (tester) async {
        final repo = FakeProductosRepo(failWith: 'No se puede publicar un producto sin imágenes');
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod(repo: repo));
        await _openRowMenu(tester, 'Llavero Nombre');
        await _tap(tester, find.text('Publicar'));
        expect(find.text('No se puede publicar un producto sin imágenes'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'prod_aviso_error');
      });

      testWidgets('filtro por categoría: hoja con buscador y teclado (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(), phone: phone, me: _admin, overrides: _prod());
        await _tap(tester, find.text('Categoría'));
        _expectSheetOk(tester, 'Filtrar por categoría');
        expectReachable(tester, _inSheet(find.text('Todas las categorías')), what: 'la opción "Todas"');
        expectReachable(tester, _inSheet(find.text('Carteles')), what: 'la última categoría');
        await shoot(tester, 'prod_hoja_categoria');

        await openKeyboard(tester, _inSheet(find.byType(TextField)));
        expectFocusedFieldVisible(tester);
        _expectSheetOk(tester, 'Filtrar por categoría');
        await shoot(tester, 'prod_hoja_categoria_teclado');

        await tester.enterText(_inSheet(find.byType(TextField)), 'funko');
        await settle(tester, 3);
        expectReachable(tester, _inSheet(find.text('Figuras de colección › Funko Pop')), what: 'el resultado');
        await shoot(tester, 'prod_hoja_categoria_busqueda');
        await tester.enterText(_inSheet(find.byType(TextField)), 'zzzz');
        await settle(tester, 3);
        expectReachable(tester, _inSheet(find.text('No hay categorías con ese nombre.')), what: 'el aviso de sin resultados');

        await tester.enterText(_inSheet(find.byType(TextField)), 'funko');
        await settle(tester, 3);
        await _tap(tester, _inSheet(find.text('Figuras de colección › Funko Pop')));
        await closeKeyboard(tester);
        expect(_sheet, findsNothing, reason: 'elegir cierra la hoja');
        expect(find.text('Funko Pop'), findsOneWidget, reason: 'el filtro muestra la categoría elegida');
        await shoot(tester, 'prod_lista_filtrada');
      });

      testWidgets('hoja de categorías con 40 categorías largas: se llega a la última (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(),
            phone: phone, me: _admin, overrides: _prod(options: _manyOptions));
        await _tap(tester, find.text('Categoría'));
        _expectSheetOk(tester, 'Filtrar por categoría');
        await shoot(tester, 'prod_hoja_categoria_muchas');
        final list = _inSheet(find.byType(Scrollable)).last;
        await scrollToEnd(tester, scrollable: list);
        expectReachable(tester, _inSheet(find.text('Nivel cinco (el más profundo)')).last,
            what: 'la última categoría de la hoja');
        await shoot(tester, 'prod_hoja_categoria_muchas_fin');
        // Con el teclado abierto también se llega al final.
        await openKeyboard(tester, _inSheet(find.byType(TextField)));
        expectFocusedFieldVisible(tester);
        await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).last);
        expectReachable(tester, _inSheet(find.text('Nivel cinco (el más profundo)')).last,
            what: 'la última categoría con el teclado abierto');
      });

      testWidgets('estados: vacío, vacío con filtros, error, sin permiso y solo lectura (${phone.name})',
          (tester) async {
        await pumpPhone(tester, const AdminProductosScreen(),
            phone: phone, me: _admin, overrides: _prod(page: _emptyPage));
        expectReachable(tester, find.text('Todavía no hay productos'), what: 'el aviso de vacío');
        expectReachable(tester, find.textContaining('Tocá "Nuevo"'), what: 'la ayuda del vacío');
        await shoot(tester, 'prod_vacio');
        await _tap(tester, find.text('Destacados'));
        expectReachable(tester, find.text('No hay productos para mostrar'), what: 'el aviso de sin resultados');
        await shoot(tester, 'prod_vacio_filtros');

        await pumpPhone(
          tester,
          const AdminProductosScreen(),
          phone: phone,
          me: _admin,
          overrides: [
            adminProductsProvider.overrideWith(
              (ref, f) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.'),
            ),
            adminProductOptionsProvider.overrideWith((ref) async => _options),
          ],
        );
        expectReachable(tester, find.textContaining('No pudimos completar'), what: 'el mensaje de error');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Reintentar"');
        await shoot(tester, 'prod_error');

        await pumpPhone(tester, const AdminProductosScreen(),
            phone: phone, me: staffWith(['productos'], actions: const []), overrides: _prod());
        expectReachable(tester, find.text('Sin acceso'), what: 'el aviso de sin acceso');
        expect(find.byType(FloatingActionButton), findsNothing);
        await shoot(tester, 'prod_sin_acceso');

        await pumpPhone(tester, const AdminProductosScreen(),
            phone: phone, me: staffWith(['productos'], role: 'operator', actions: const ['ver']), overrides: _prod());
        expect(find.text('Mate Mario'), findsOneWidget);
        expect(find.byType(FloatingActionButton), findsNothing);
        expect(find.byIcon(Icons.more_vert_rounded), findsNothing);
        await shoot(tester, 'prod_solo_lectura');
      });

      testWidgets('"Ver más" no pierde el lugar ni vacía la lista (${phone.name})', (tester) async {
        var asked = 0;
        await pumpPhone(
          tester,
          const AdminProductosScreen(),
          phone: phone,
          me: _admin,
          overrides: [
            adminProductsProvider.overrideWith((ref, f) async {
              asked++;
              // Como el servidor: tarda un poco y devuelve hasta `limit`.
              await Future<void>.delayed(const Duration(milliseconds: 300));
              return _bigPage(f.limit.clamp(0, 57), 57);
            }),
            adminProductOptionsProvider.overrideWith((ref) async => _options),
            productosRepoProvider.overrideWithValue(FakeProductosRepo()),
          ],
        );
        await scrollToEnd(tester, scrollable: _mainList());
        expectReachable(tester, find.text('Ver más (17 restantes)'), what: 'el botón "Ver más"');
        final before = tester.state<ScrollableState>(_mainList()).position.pixels;
        expect(before > 1000, isTrue);
        await tester.tap(find.text('Ver más (17 restantes)'));
        await tester.pump(const Duration(milliseconds: 100));
        // Mientras llega la tanda siguiente, lo que ya se veía sigue ahí.
        expect(find.text('Producto número 40'), findsOneWidget,
            reason: 'al pedir más, la lista no puede vaciarse (esqueleto) y volver arriba');
        await shoot(tester, 'prod_ver_mas_cargando');
        await settle(tester, 8);
        expect(asked, 2);
        final after = tester.state<ScrollableState>(_mainList()).position.pixels;
        // Mismo lugar (se toleran unos píxeles: la lista ajusta sus alturas
        // estimadas al sumar filas). Antes volvía a 0.
        expect((after - before).abs() < 40, isTrue,
            reason: 'después de "Ver más" la lista perdió el lugar (estaba en $before, quedó en $after)');
        expect(find.text('Producto número 40'), findsOneWidget, reason: 'la fila que se estaba mirando sigue ahí');
        await scrollToEnd(tester, scrollable: _mainList());
        expectReachable(tester, find.text('Producto número 57'), what: 'el último producto');
        expect(find.textContaining('Ver más'), findsNothing);
        await shoot(tester, 'prod_ver_mas_fin');
      });
    }
  });

  // =========================================================================
  // PRODUCTOS · FICHA
  // =========================================================================
  group('Productos · ficha', () {
    Future<void> openDetail(WidgetTester tester, Phone phone,
        {AdminProductDetail? detail,
        FakeProductosRepo? repo,
        PhotoSource? photos,
        String row = 'Mate Mario',
        double textScale = 1}) async {
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: textScale, overrides: _prod(detail: detail, repo: repo, photos: photos));
      await _reveal(tester, find.text(row), _mainList());
      await _tap(tester, find.text(row), frames: 8);
      expect(find.byType(AdminProductDetailScreen), findsOneWidget);
      expectNoLayoutErrors(tester, 'al abrir la ficha');
    }

    Finder detailScroll() =>
        find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;

    for (final phone in Phone.both) {
      testWidgets('ficha completa: se dibuja y llega al final (${phone.name})', (tester) async {
        await openDetail(tester, phone);
        expectReachable(tester, find.byTooltip('Editar'), what: 'el botón de editar');
        expectReachable(tester, find.byTooltip('Atrás'), what: 'la flecha de volver');
        await shoot(tester, 'ficha');
        final list = find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;
        // Los botones de acción, uno por uno, a la vista al desplazar.
        for (final b in ['Archivar', 'Quitar destacado', 'Ver en la tienda', 'Eliminar']) {
          await _reveal(tester, find.text(b), list);
          expectReachable(tester, find.text(b), what: 'el botón "$b"');
        }
        await shoot(tester, 'ficha_acciones');
        await scrollToEnd(tester, scrollable: list);
        expectReachable(tester, find.textContaining('se cargan desde el panel web'), what: 'la nota final');
        await shoot(tester, 'ficha_fin');
      });

      testWidgets('ficha al límite: nombres largos, 9 cifras, 14 colores, 6 tamaños, 8 fotos (${phone.name})',
          (tester) async {
        await openDetail(tester, phone, detail: _extremeDetail);
        await shoot(tester, 'ficha_extrema');
        final list = find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;
        final pos = tester.state<ScrollableState>(list).position;
        // Se recorre de a una pantalla para que cada tramo se dibuje.
        var n = 0;
        while (pos.pixels < pos.maxScrollExtent - 1 && n < 30) {
          pos.jumpTo((pos.pixels + 420).clamp(0, pos.maxScrollExtent));
          await tester.pump(const Duration(milliseconds: 60));
          expectNoLayoutErrors(tester, 'al recorrer la ficha extrema (tramo $n)');
          if (n < 4) await shoot(tester, 'ficha_extrema_$n');
          n++;
        }
        await scrollToEnd(tester, scrollable: list);
        expectReachable(tester, find.textContaining('se cargan desde el panel web'), what: 'la nota final');
        await shoot(tester, 'ficha_extrema_fin');
      });

      testWidgets('ficha con todo en null y borrador sin fotos (${phone.name})', (tester) async {
        await openDetail(tester, phone, detail: _bareDetail, row: 'Sin nombre');
        expectReachable(tester, find.text('Sin fotos'), what: 'el aviso de sin fotos');
        await shoot(tester, 'ficha_minima');
        await _reveal(tester, find.text('Sin categoría'), detailScroll());
        await scrollToEnd(tester, scrollable: detailScroll());
        expectReachable(tester, find.textContaining('se cargan desde el panel web'), what: 'la nota final');
        await shoot(tester, 'ficha_minima_fin');

        final repo = FakeProductosRepo();
        await openDetail(tester, phone, detail: _draftDetail, repo: repo, row: 'Cartel Personalizado');
        // Las fotos se suman desde acá: los dos botones, a la vista de entrada.
        expect(find.textContaining('Se suben desde el panel web'), findsNothing);
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Sumar fotos'), what: 'el botón Sumar fotos');
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Sacar foto'), what: 'el botón Sacar foto');
        await shoot(tester, 'ficha_borrador');
        await _reveal(tester, find.text('Publicar'), detailScroll());
        await _tap(tester, find.text('Publicar'));
        expect(repo.calls, isEmpty, reason: 'sin fotos no se llama al servidor');
        expect(find.textContaining('No se puede publicar un producto sin fotos'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'ficha_borrador_aviso');
      });

      testWidgets('fotos: sumar eligiendo el color, portada y eliminar (${phone.name})', (tester) async {
        final repo = FakeProductosRepo();
        final source = FakePhotoSource(gallery: [fakePhoto('uno.jpg'), fakePhoto('dos.jpg')]);
        await openDetail(tester, phone, repo: repo, photos: source);
        final add = find.widgetWithText(OutlinedButton, 'Sumar fotos');
        await _reveal(tester, add, detailScroll());
        expectReachable(tester, add, what: 'el botón Sumar fotos');
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Sacar foto'), what: 'el botón Sacar foto');
        expect(find.text('3 de 5 fotos.'), findsOneWidget);
        await shoot(tester, 'ficha_fotos');
        await _reveal(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'), detailScroll());
        expectReachable(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'), what: 'el botón Eliminar foto');
        await _reveal(tester, add, detailScroll());

        // Tiene tres colores: pregunta de cuál son las fotos.
        await _tap(tester, add, frames: 8);
        _expectSheetOk(tester, '¿De qué color son las fotos?');
        for (final o in ['De ninguno en particular', 'Rojo', 'Negro', 'Verde militar']) {
          expectReachable(tester, _inSheet(find.text(o)), what: 'la opción "$o"');
        }
        await shoot(tester, 'ficha_fotos_color');
        await _tap(tester, _inSheet(find.text('Negro')), frames: 8);
        expectNoLayoutErrors(tester);
        expect(repo.calls, ['image:p1:uno.jpg:Negro', 'image:p1:dos.jpg:Negro']);
        expect(find.text('2 fotos agregadas'), findsOneWidget);
        await shoot(tester, 'ficha_fotos_agregadas');

        // Elegir la segunda miniatura: aparece "Usar como portada" al lado de "Eliminar foto".
        await _reveal(tester, find.byType(NetImage).at(2), detailScroll());
        await _tap(tester, find.byType(NetImage).at(2));
        final cover = find.widgetWithText(OutlinedButton, 'Usar como portada');
        await _reveal(tester, cover, detailScroll());
        expectReachable(tester, cover, what: 'el botón Usar como portada');
        await shoot(tester, 'ficha_fotos_segunda');

        await _reveal(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'), detailScroll());
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'));
        expectNoLayoutErrors(tester, 'con la confirmación abierta');
        final dialog = find.byType(AlertDialog);
        expect(find.descendant(of: dialog, matching: find.text('¿Eliminar esta foto?')), findsOneWidget);
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Eliminar foto')), what: 'Eliminar foto');
        expectReachable(tester, find.descendant(of: dialog, matching: find.text('Cancelar')), what: 'Cancelar');
        await shoot(tester, 'ficha_fotos_eliminar');
        await _tap(tester, find.descendant(of: dialog, matching: find.text('Eliminar foto')), frames: 8);
        expectNoLayoutErrors(tester);
        expect(repo.calls.last, 'image_delete:p1:i2');
        expect(find.text('Foto eliminada'), findsOneWidget);
      });

      testWidgets('fotos: tope, foto pesada y rechazo del servidor (${phone.name})', (tester) async {
        // 8 fotos (más que el tope): no deja sumar y lo explica.
        await openDetail(tester, phone, detail: _extremeDetail, row: _longName);
        final add = find.widgetWithText(OutlinedButton, 'Sumar fotos');
        await _reveal(tester, add, detailScroll());
        expect(tester.widget<OutlinedButton>(add).onPressed, isNull);
        expectReachable(tester, find.textContaining('Llegaste al tope de 5 fotos'), what: 'el aviso del tope');
        await shoot(tester, 'ficha_fotos_tope');

        // Borrador sin fotos: una pesada no se manda; el rechazo del servidor se lee entero.
        final repo = FakeProductosRepo(failWith: _serverCostError);
        final source = FakePhotoSource(
          gallery: [PickedPhoto(bytes: Uint8List(maxUploadImageBytes + 1), filename: 'pesada.jpg')],
          camera: fakePhoto('foto.jpg'),
        );
        await openDetail(tester, phone, detail: _draftDetail, repo: repo, photos: source, row: 'Cartel Personalizado');
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Sumar fotos'), frames: 8);
        expectNoLayoutErrors(tester);
        expect(repo.calls, isEmpty);
        expectReachable(tester, find.textContaining('pesa más de 4 MB'), what: 'el aviso del peso');
        await shoot(tester, 'ficha_fotos_pesada');
        await _tap(tester, find.widgetWithText(OutlinedButton, 'Sacar foto'), frames: 8);
        expectNoLayoutErrors(tester);
        expect(repo.calls, ['image:p3:foto.jpg:-']);
        expectReachable(tester, find.text(_serverCostError), what: 'el rechazo del servidor');
        await shoot(tester, 'ficha_fotos_rechazo');
      });

      testWidgets('archivar y eliminar desde la ficha (${phone.name})', (tester) async {
        final repo = FakeProductosRepo();
        await openDetail(tester, phone, repo: repo);
        await _reveal(tester, find.text('Archivar'), detailScroll());
        await _tap(tester, find.text('Archivar'));
        _expectDialogOk(tester, confirm: 'Archivar');
        await shoot(tester, 'ficha_dialogo_archivar');
        await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));
        expect(repo.calls, isEmpty);

        await _reveal(tester, find.text('Eliminar'), detailScroll());
        await _tap(tester, find.text('Eliminar'));
        _expectDialogOk(tester, confirm: 'Eliminar para siempre');
        await shoot(tester, 'ficha_dialogo_eliminar');
        await _tap(tester, find.widgetWithText(TextButton, 'Eliminar para siempre'), frames: 10);
        expect(repo.calls, ['delete:p1']);
        expect(find.byType(AdminProductDetailScreen), findsNothing, reason: 'al borrar vuelve al listado');
        expect(find.text('Producto eliminado'), findsOneWidget);
        expectNoLayoutErrors(tester);
      });

      testWidgets('elegir otra foto como portada (${phone.name})', (tester) async {
        final repo = FakeProductosRepo();
        await openDetail(tester, phone, repo: repo);
        expect(find.text('Usar como portada'), findsNothing, reason: 'la foto a la vista ya es la portada');
        await tester.tap(find.byType(NetImage).at(2)); // 0 = grande, 1 y 2 = miniaturas
        await settle(tester, 3);
        expectReachable(tester, find.text('Usar como portada'), what: 'el botón "Usar como portada"');
        await shoot(tester, 'ficha_portada');
        await _tap(tester, find.text('Usar como portada'));
        expect(repo.calls, ['primary:p1:i2']);
        expect(find.text('Listo, esa foto es la portada'), findsOneWidget);
      });

      testWidgets('error al cargar la ficha (${phone.name})', (tester) async {
        await pumpPhone(
          tester,
          const AdminProductDetailScreen(id: 'zzz'),
          phone: phone,
          me: _admin,
          overrides: [
            adminProductProvider.overrideWith((ref, id) => throw ApiException('not_found', 'No encontramos el producto.')),
          ],
        );
        expectReachable(tester, find.text('No encontramos el producto.'), what: 'el mensaje');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Reintentar"');
        await shoot(tester, 'ficha_error');
      });
    }
  });

  // =========================================================================
  // PRODUCTOS · FORMULARIO
  // =========================================================================
  group('Productos · formulario', () {
    Finder field(String label) => find.widgetWithText(TextField, label);
    const lastField = 'Tiempo de entrega (opcional)';

    /// Abre el alta por el camino real: botón "Nuevo" del listado.
    Future<void> openCreate(WidgetTester tester, Phone phone,
        {FakeProductosRepo? repo, ProductOptions? options, double textScale = 1, HefestoThemeMode theme = HefestoThemeMode.dark}) async {
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: textScale, theme: theme, overrides: _prod(repo: repo, options: options));
      await _tap(tester, find.byType(FloatingActionButton), frames: 8);
      expect(find.byType(AdminProductFormScreen), findsOneWidget);
      expectNoLayoutErrors(tester, 'al abrir el alta');
    }

    /// Abre la edición por el camino real: fila → ficha → lápiz.
    Future<void> openEdit(WidgetTester tester, Phone phone,
        {FakeProductosRepo? repo, AdminProductDetail? detail, double textScale = 1}) async {
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: textScale, overrides: _prod(repo: repo, detail: detail));
      await _tap(tester, find.text('Mate Mario'), frames: 8);
      await _tap(tester, find.byTooltip('Editar'), frames: 8);
      expect(find.byType(AdminProductFormScreen), findsOneWidget);
      expectNoLayoutErrors(tester, 'al abrir la edición');
    }

    Finder formScroll() =>
        find.descendant(of: find.byType(AdminProductFormScreen), matching: find.byType(Scrollable)).first;

    /// Escribe en un campo (lo trae a la vista antes: puede estar lejos).
    Future<void> type(WidgetTester tester, String label, String text) async {
      await _reveal(tester, field(label), formScroll());
      await tester.enterText(field(label), text);
      await tester.pump();
    }

    for (final phone in Phone.both) {
      testWidgets('alta: se dibuja, llega al final y el botón queda a la vista (${phone.name})', (tester) async {
        await openCreate(tester, phone);
        expectReachable(tester, find.text('Nuevo producto'), what: 'el título');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Crear producto"');
        // Las fotos van después, en la ficha: el alta lo dice de entrada.
        expectReachable(tester, find.textContaining('ahí le sumás las fotos'), what: 'el aviso de las fotos');
        expect(find.textContaining('panel web'), findsNothing);
        await shoot(tester, 'form_alta');
        await scrollToEnd(tester, scrollable: formScroll());
        expectReachable(tester, find.text('Destacado'), what: 'el interruptor "Destacado"');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Crear producto"');
        await shoot(tester, 'form_alta_fin');
      });

      testWidgets('alta: teclado en el primer y en el último campo; guardar sigue a mano (${phone.name})',
          (tester) async {
        await openCreate(tester, phone);
        await openKeyboard(tester, field('Nombre'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
        await shoot(tester, 'form_alta_teclado_nombre');

        for (final label in ['Descripción (opcional)', 'Precio', 'Precio de oferta (opcional)', 'Gramos', 'Minutos', 'Medidas (opcional)']) {
          await _reveal(tester, field(label), formScroll());
          await tester.tap(field(label), warnIfMissed: false);
          await settle(tester, 4);
          expectFocusedFieldVisible(tester);
        }

        await closeKeyboard(tester);
        await _reveal(tester, field(lastField), formScroll());
        await openKeyboard(tester, field(lastField));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
        await shoot(tester, 'form_alta_teclado_ultimo');
      });

      testWidgets('alta: guardar con datos faltantes muestra QUÉ falta aunque esté lejos (${phone.name})',
          (tester) async {
        final repo = FakeProductosRepo();
        await openCreate(tester, phone, repo: repo);
        // La persona completa el final del formulario y se olvida de lo de arriba.
        await scrollToEnd(tester, scrollable: formScroll());
        await _tap(tester, find.byType(GoldButton));
        expect(repo.calls, isEmpty);
        expect(_isOnScreen(tester, find.text('Poné un nombre.')), isTrue,
            reason: 'tocar "Crear producto" con el nombre vacío tiene que mostrar el error: '
                'si queda arriba, fuera de la vista, el botón parece no hacer nada');
        await shoot(tester, 'form_alta_validacion');
      });

      testWidgets('alta: hoja de material (pocos y 35 con nombres largos) (${phone.name})', (tester) async {
        await openCreate(tester, phone);
        await _reveal(tester, find.text('Sin definir'), formScroll());
        await _tap(tester, find.text('Sin definir'));
        _expectSheetOk(tester, 'Material');
        expectReachable(tester, _inSheet(find.text('Sin definir')), what: 'la opción "Sin definir"');
        expectReachable(tester, _inSheet(find.text('PLA')), what: 'la última opción');
        await shoot(tester, 'form_hoja_material');
        await _tap(tester, _inSheet(find.text('PLA')));
        expect(_sheet, findsNothing);
        expect(find.text('PLA'), findsOneWidget, reason: 'el campo muestra el material elegido');

        await openCreate(tester, phone, options: _manyOptions);
        await _reveal(tester, find.text('Sin definir'), formScroll());
        await _tap(tester, find.text('Sin definir'));
        _expectSheetOk(tester, 'Material');
        await shoot(tester, 'form_hoja_material_muchos');
        await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).first);
        // En el orden que manda el servidor: el último es el 35.
        expectReachable(tester, _inSheet(find.text('Material especial número 35 con nombre largo')),
            what: 'el último material de la hoja');
        await shoot(tester, 'form_hoja_material_muchos_fin');
      });

      testWidgets('alta: hoja de categoría desde el formulario, con teclado (${phone.name})', (tester) async {
        await openCreate(tester, phone, options: _manyOptions);
        await _tap(tester, find.text('Elegí una categoría'));
        _expectSheetOk(tester, 'Elegí una categoría');
        await shoot(tester, 'form_hoja_categoria');
        await openKeyboard(tester, _inSheet(find.byType(TextField)));
        expectFocusedFieldVisible(tester);
        _expectSheetOk(tester, 'Elegí una categoría');
        await shoot(tester, 'form_hoja_categoria_teclado');
        await tester.enterText(_inSheet(find.byType(TextField)), 'nivel cinco');
        await settle(tester, 3);
        await _tap(tester, _inSheet(find.textContaining('Categoría 3 ›')));
        await closeKeyboard(tester);
        expect(_sheet, findsNothing);
        expect(find.textContaining('Categoría 3 › Subcategoría A'), findsOneWidget,
            reason: 'el campo muestra la ruta de la categoría elegida');
        expectNoLayoutErrors(tester);
        await shoot(tester, 'form_categoria_elegida');
      });

      testWidgets('alta completa: precios con coma y con punto (${phone.name})', (tester) async {
        Future<Map<String, dynamic>?> create(String price, String sale) async {
          final repo = FakeProductosRepo();
          await openCreate(tester, phone, repo: repo);
          await type(tester, 'Nombre', 'Mate Luigi');
          await type(tester, 'Precio', price);
          await type(tester, 'Precio de oferta (opcional)', sale);
          await type(tester, 'Gramos', '90');
          await type(tester, 'Minutos', '180');
          await settle(tester, 2);
          await _reveal(tester, find.text('Elegí una categoría'), formScroll());
          await _tap(tester, find.text('Elegí una categoría'));
          await _tap(tester, _inSheet(find.text('Funko Pop')));
          await _tap(tester, find.byType(GoldButton), frames: 10);
          expectNoLayoutErrors(tester);
          return repo.lastCreate;
        }

        final a = await create('1.500,50', '1.200');
        expect(a?['price'], 1500.5);
        expect(a?['salePrice'], 1200.0);
        final b = await create('1500.5', '1200,25');
        expect(b?['price'], 1500.5);
        expect(b?['salePrice'], 1200.25);
        final c = await create('123.456.789', '');
        expect(c?['price'], 123456789.0);
        expect(c?.containsKey('salePrice'), isFalse);
      });

      testWidgets('alta: un error largo del servidor con el teclado abierto no rompe la pantalla (${phone.name})',
          (tester) async {
        final repo = FakeProductosRepo(failWith: _serverCostError);
        await openCreate(tester, phone, repo: repo);
        await type(tester, 'Nombre', 'Mate Luigi');
        await type(tester, 'Precio', '25000');
        await _reveal(tester, find.text('Elegí una categoría'), formScroll());
        await _tap(tester, find.text('Elegí una categoría'));
        await _tap(tester, _inSheet(find.text('Funko Pop')));
        await _reveal(tester, field(lastField), formScroll());
        await openKeyboard(tester, field(lastField));
        await _tap(tester, find.byType(GoldButton), frames: 8);
        expect(repo.calls, ['create']);
        expectNoLayoutErrors(tester);
        expectReachable(tester, find.textContaining('No pudimos calcular el costo'), what: 'el error del servidor');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón para reintentar');
        await shoot(tester, 'form_alta_error_servidor');
      });

      testWidgets('alta: tocar dos veces "Crear producto" crea UN solo producto (${phone.name})', (tester) async {
        final gate = Completer<void>();
        final repo = FakeProductosRepo(gate: gate);
        await openCreate(tester, phone, repo: repo);
        await type(tester, 'Nombre', 'Mate Luigi');
        await type(tester, 'Precio', '25000');
        await _reveal(tester, find.text('Elegí una categoría'), formScroll());
        await _tap(tester, find.text('Elegí una categoría'));
        await _tap(tester, _inSheet(find.text('Funko Pop')));
        // Dos toques seguidos, sin que la pantalla llegue a redibujarse entre uno y otro.
        final button = tester.widget<GoldButton>(find.byType(GoldButton));
        button.onPressed!();
        button.onPressed!();
        await settle(tester, 3);
        expect(repo.calls, ['create'], reason: 'el segundo toque no puede mandar otra alta');
        await shoot(tester, 'form_alta_guardando');
        gate.complete();
        await settle(tester, 8);
        expectNoLayoutErrors(tester);
      });

      testWidgets('alta: salir con datos cargados pregunta antes de perderlos (${phone.name})', (tester) async {
        await openCreate(tester, phone);
        // Sin tocar nada se sale directo.
        await _tap(tester, find.byTooltip('Atrás'), frames: 8);
        expect(find.byType(AdminProductFormScreen), findsNothing);

        await _tap(tester, find.byType(FloatingActionButton), frames: 8);
        await tester.enterText(field('Nombre'), 'Mate Luigi');
        await settle(tester, 2);
        await _tap(tester, find.byTooltip('Atrás'));
        expect(find.text('¿Descartar los cambios?'), findsOneWidget,
            reason: 'volver atrás con el alta a medio cargar perdía todo sin avisar');
        _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
        await shoot(tester, 'form_alta_descartar');
        await _tap(tester, find.widgetWithText(TextButton, 'Seguir editando'));
        expect(find.byType(AdminProductFormScreen), findsOneWidget);
        expect(find.text('Mate Luigi'), findsOneWidget, reason: 'lo cargado sigue ahí');
        await _tap(tester, find.byTooltip('Atrás'));
        await _tap(tester, find.widgetWithText(TextButton, 'Descartar'), frames: 8);
        expect(find.byType(AdminProductFormScreen), findsNothing);
      });

      testWidgets('edición: se dibuja con datos al límite, teclado y diálogo de descartar (${phone.name})',
          (tester) async {
        final repo = FakeProductosRepo();
        await openEdit(tester, phone, repo: repo, detail: _extremeDetail);
        expect(tester.widget<GoldButton>(find.byType(GoldButton)).onPressed, isNull,
            reason: 'sin cambios no se puede guardar');
        await shoot(tester, 'form_edicion');
        await scrollToEnd(tester, scrollable: formScroll());
        expectReachable(tester, find.text('Destacado'), what: 'el interruptor "Destacado"');
        await shoot(tester, 'form_edicion_fin');

        await _reveal(tester, field(lastField), formScroll());
        await openKeyboard(tester, field(lastField));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
        await tester.enterText(field(lastField), '10 días');
        await settle(tester, 3);
        await closeKeyboard(tester);
        expect(tester.widget<GoldButton>(find.byType(GoldButton)).onPressed, isNotNull);

        await _tap(tester, find.byTooltip('Atrás'));
        _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
        await shoot(tester, 'form_edicion_descartar');
        await _tap(tester, find.widgetWithText(TextButton, 'Seguir editando'));

        await _tap(tester, find.byType(GoldButton), frames: 10);
        expect(repo.calls, ['patch:p2']);
        expect(repo.lastPatch, {'productionTime': '10 días'});
        expect(find.byType(AdminProductFormScreen), findsNothing);
        expect(find.text('Cambios guardados'), findsOneWidget);
        expectNoLayoutErrors(tester);
      });
    }
  });

  // =========================================================================
  // CATEGORÍAS · LISTADO
  // =========================================================================
  group('Categorías · listado', () {
    for (final phone in Phone.both) {
      testWidgets('árbol: se dibuja, se despliega y llega al final (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminCategoriasScreen(), phone: phone, me: _admin, overrides: _catOv());
        expectReachable(tester, find.text('Categorías'), what: 'el título');
        expectReachable(tester, find.byType(FloatingActionButton), what: 'el botón "Nueva"');
        await shoot(tester, 'cat_lista');
        await _tap(tester, find.text('Figuras de colección'), frames: 4);
        await _tap(tester, find.text('Funko Pop'), frames: 4);
        expect(find.text('Superhéroes'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'cat_lista_desplegada');
        await scrollToEnd(tester, scrollable: _mainList());
        expectReachable(tester, find.textContaining('se cambian desde el panel web'), what: 'la nota final');
        final fab = tester.getRect(find.byType(FloatingActionButton));
        final last = tester.getRect(find.text('Mates'));
        expect(last.bottom <= fab.top, isTrue, reason: 'el botón flotante tapa la última categoría');
        await shoot(tester, 'cat_lista_fin');
      });

      testWidgets('40 categorías, 5 niveles, nombres largos y contadores de 9 cifras (${phone.name})',
          (tester) async {
        await pumpPhone(tester, const AdminCategoriasScreen(),
            phone: phone, me: _admin, overrides: _catOv(data: _manyCats));
        await shoot(tester, 'cat_muchas');
        // Despliega toda la primera rama (cinco niveles).
        for (final name in [
          'Categoría principal número 1 con un nombre bastante largo para el celular',
          'Subcategoría A de la 1 con nombre largo',
          'Nivel tres con otro nombre largo que no entra en una sola línea',
          'Nivel cuatro',
        ]) {
          await tester.ensureVisible(find.text(name).first);
          await tester.pump();
          await _tap(tester, find.text(name).first, frames: 4);
          expectNoLayoutErrors(tester, 'al desplegar "$name"');
        }
        expect(find.text('Nivel cinco (el más profundo de todos los niveles)'), findsOneWidget);
        await shoot(tester, 'cat_muchas_desplegada');
        await scrollToEnd(tester, scrollable: _mainList());
        expectReachable(tester, find.textContaining('se cambian desde el panel web'), what: 'la nota final');
        await shoot(tester, 'cat_muchas_fin');
      });

      testWidgets('menú de la fila y sus diálogos (${phone.name})', (tester) async {
        final repo = FakeCategoriasRepo();
        await pumpPhone(tester, const AdminCategoriasScreen(), phone: phone, me: _admin, overrides: _catOv(repo: repo));
        await _openRowMenu(tester, 'Llaveros');
        for (final o in ['Editar', 'Nueva subcategoría', 'Eliminar']) {
          expectReachable(tester, find.text(o), what: 'la opción "$o"');
        }
        await shoot(tester, 'cat_menu_fila');
        await _tap(tester, find.text('Eliminar'));
        expect(find.text('No se puede borrar "Llaveros"'), findsOneWidget);
        _expectDialogOk(tester, confirm: 'Entendido', cancel: null);
        await shoot(tester, 'cat_dialogo_no_borrar');
        await _tap(tester, find.widgetWithText(TextButton, 'Entendido'));
        expect(repo.calls, isEmpty);

        // Nombre larguísimo: el diálogo igual entra entero.
        await _openRowMenu(tester, 'Decoración y hogar para toda la familia con un nombre bien largo');
        await _tap(tester, find.text('Eliminar'));
        _expectDialogOk(tester, confirm: 'Entendido', cancel: null);
        await shoot(tester, 'cat_dialogo_no_borrar_largo');
        await _tap(tester, find.widgetWithText(TextButton, 'Entendido'));

        await _openRowMenu(tester, 'Mates');
        await shoot(tester, 'cat_menu_fila_ultima');
        await _tap(tester, find.text('Eliminar'));
        expect(find.text('¿Eliminar "Mates"?'), findsOneWidget);
        _expectDialogOk(tester, confirm: 'Eliminar');
        await shoot(tester, 'cat_dialogo_eliminar');
        await _tap(tester, find.widgetWithText(TextButton, 'Eliminar'), frames: 8);
        expect(repo.calls, ['delete:m']);
        expect(find.text('Categoría eliminada'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'cat_aviso_eliminada');
      });

      testWidgets('un error del servidor al borrar se avisa (${phone.name})', (tester) async {
        final repo = FakeCategoriasRepo(failWith: 'No se puede borrar: la categoría tiene 3 producto(s). Reasignalos primero.');
        await pumpPhone(tester, const AdminCategoriasScreen(), phone: phone, me: _admin, overrides: _catOv(repo: repo));
        await _openRowMenu(tester, 'Mates');
        await _tap(tester, find.text('Eliminar'));
        await _tap(tester, find.widgetWithText(TextButton, 'Eliminar'), frames: 8);
        expect(find.textContaining('la categoría tiene 3 producto(s)'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'cat_aviso_error');
      });

      testWidgets('buscar con el teclado abierto (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminCategoriasScreen(), phone: phone, me: _admin, overrides: _catOv());
        await openKeyboard(tester, find.byType(TextField));
        expectFocusedFieldVisible(tester);
        expect(find.byType(FloatingActionButton), findsNothing,
            reason: 'con el teclado abierto el botón flotante quedaba encima de los resultados');
        await tester.enterText(find.byType(TextField), 'super');
        await settle(tester, 3);
        expectReachable(tester, find.text('Superhéroes'), what: 'el resultado');
        expect(find.text('Figuras de colección › Funko Pop › Superhéroes'), findsOneWidget);
        await shoot(tester, 'cat_busqueda_teclado');
        await tester.enterText(find.byType(TextField), 'zzzz');
        await settle(tester, 3);
        expect(find.text('Sin resultados'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'cat_busqueda_vacia_teclado');
      });

      testWidgets('estados: vacío, error, sin permiso y solo lectura (${phone.name})', (tester) async {
        await pumpPhone(tester, const AdminCategoriasScreen(),
            phone: phone, me: _admin, overrides: _catOv(data: _emptyCats));
        expectReachable(tester, find.text('Todavía no hay categorías'), what: 'el aviso de vacío');
        expectReachable(tester, find.textContaining('Tocá "Nueva"'), what: 'la ayuda del vacío');
        await shoot(tester, 'cat_vacio');

        await pumpPhone(
          tester,
          const AdminCategoriasScreen(),
          phone: phone,
          me: _admin,
          overrides: [
            adminCategoriesProvider.overrideWith(
              (ref) => throw ApiException('offline', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'),
            ),
          ],
        );
        expectReachable(tester, find.textContaining('No pudimos conectarnos'), what: 'el mensaje de error');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Reintentar"');
        expect(find.byType(FloatingActionButton), findsNothing);
        await shoot(tester, 'cat_error');

        await pumpPhone(tester, const AdminCategoriasScreen(),
            phone: phone, me: staffWith(['productos'], actions: const []), overrides: _catOv());
        expectReachable(tester, find.text('Sin acceso'), what: 'el aviso de sin acceso');
        await shoot(tester, 'cat_sin_acceso');

        await pumpPhone(tester, const AdminCategoriasScreen(),
            phone: phone, me: staffWith(['productos'], role: 'operator', actions: const ['ver']), overrides: _catOv());
        expect(find.text('Llaveros'), findsOneWidget);
        expect(find.byType(FloatingActionButton), findsNothing);
        expect(find.byIcon(Icons.more_vert_rounded), findsNothing);
        await shoot(tester, 'cat_solo_lectura');
      });
    }
  });

  // =========================================================================
  // CATEGORÍAS · FORMULARIO
  // =========================================================================
  group('Categorías · formulario', () {
    Finder formScroll() =>
        find.descendant(of: find.byType(AdminCategoryFormScreen), matching: find.byType(Scrollable)).first;

    /// Alta por el camino real: botón "Nueva" del listado.
    Future<void> openCreate(WidgetTester tester, Phone phone,
        {FakeCategoriasRepo? repo, AdminCategoriesData? data, double textScale = 1, HefestoThemeMode theme = HefestoThemeMode.dark}) async {
      await pumpPhone(tester, const AdminCategoriasScreen(),
          phone: phone, me: _admin, textScale: textScale, theme: theme, overrides: _catOv(repo: repo, data: data));
      await _tap(tester, find.byType(FloatingActionButton), frames: 8);
      expect(find.byType(AdminCategoryFormScreen), findsOneWidget);
      expectNoLayoutErrors(tester, 'al abrir el alta de categoría');
    }

    for (final phone in Phone.both) {
      testWidgets('alta: se dibuja, llega al final (íconos y colores) y el botón queda a la vista (${phone.name})',
          (tester) async {
        await openCreate(tester, phone);
        expectReachable(tester, find.text('Nueva categoría'), what: 'el título');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Crear categoría"');
        await shoot(tester, 'catform_alta');
        await scrollToEnd(tester, scrollable: formScroll());
        expectReachable(tester, find.byType(GoldButton), what: 'el botón "Crear categoría"');
        // El último color se llega a tocar (no queda bajo la barra de abajo).
        // Las casillas de ícono y de color (la última es el último color).
        final swatches = find.byWidgetPredicate((w) => '${w.runtimeType}' == '_Swatch');
        expect(swatches, findsNWidgets(kCategoryIcons.length + kCategoryColors.length));
        expectReachable(tester, swatches.last, what: 'el último color');
        expect(tester.getSize(swatches.last).shortestSide >= 44, isTrue,
            reason: 'la casilla de color mide ${tester.getSize(swatches.last)}: cuesta acertarle');
        await _tap(tester, swatches.last, frames: 3);
        await shoot(tester, 'catform_alta_fin');
      });

      testWidgets('alta: teclado en el nombre; guardar a mano; guardar vacío muestra el error (${phone.name})',
          (tester) async {
        final repo = FakeCategoriasRepo();
        await openCreate(tester, phone, repo: repo);
        await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre'));
        expectFocusedFieldVisible(tester);
        expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
        await shoot(tester, 'catform_alta_teclado');
        await closeKeyboard(tester);

        // Desde el final (eligiendo color), "Crear" con el nombre vacío.
        await scrollToEnd(tester, scrollable: formScroll());
        await _tap(tester, find.byType(GoldButton));
        expect(repo.calls, isEmpty);
        expect(_isOnScreen(tester, find.text('Poné un nombre.')), isTrue,
            reason: 'el error del nombre tiene que quedar a la vista; si no, el botón parece no hacer nada');
        await shoot(tester, 'catform_alta_validacion');
      });

      testWidgets('alta: nombre al límite (80 letras) y error del servidor en línea (${phone.name})', (tester) async {
        final repo = FakeCategoriasRepo(failWith: 'Ya existe una categoría con ese nombre o slug.');
        await openCreate(tester, phone, repo: repo);
        await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Decoración y hogar para toda la familia con un nombre bien largo de ochenta!!');
        await settle(tester, 3);
        expectNoLayoutErrors(tester);
        await shoot(tester, 'catform_alta_nombre_largo');
        await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre'));
        await _tap(tester, find.byType(GoldButton), frames: 8);
        expect(repo.calls, ['create']);
        expectReachable(tester, find.text('Ya existe una categoría con ese nombre o slug.'), what: 'el error del servidor');
        expectReachable(tester, find.byType(GoldButton), what: 'el botón para reintentar');
        await shoot(tester, 'catform_alta_error_servidor');
      });

      testWidgets('"Dentro de…": hoja con buscador, teclado y 40 categorías (${phone.name})', (tester) async {
        final repo = FakeCategoriasRepo();
        await openCreate(tester, phone, repo: repo, data: _manyCats);
        await _tap(tester, find.text('Ninguna (categoría principal)'));
        _expectSheetOk(tester, 'Dentro de…');
        expectReachable(tester, _inSheet(find.text('Ninguna (categoría principal)')), what: 'la opción "Ninguna"');
        await shoot(tester, 'catform_hoja_padre');
        await scrollToEnd(tester, scrollable: _inSheet(find.byType(Scrollable)).last);
        expectReachable(tester, _inSheet(find.text('Nivel cinco (el más profundo de todos los niveles)')).last,
            what: 'la última categoría de la hoja');
        await shoot(tester, 'catform_hoja_padre_fin');
        await openKeyboard(tester, _inSheet(find.byType(TextField)));
        expectFocusedFieldVisible(tester);
        _expectSheetOk(tester, 'Dentro de…');
        await shoot(tester, 'catform_hoja_padre_teclado');
        await tester.enterText(_inSheet(find.byType(TextField)), 'categoría 5 ›');
        await settle(tester, 3);
        await _tap(tester, _inSheet(find.textContaining('Nivel cuatro › Nivel cinco')));
        await closeKeyboard(tester);
        expect(_sheet, findsNothing);
        expect(find.textContaining('Categoría 5 › Sub A'), findsOneWidget, reason: 'el campo muestra la ruta del padre elegido');
        expectNoLayoutErrors(tester);
        await shoot(tester, 'catform_padre_elegido');

        await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Marvel');
        await settle(tester, 2);
        await _tap(tester, find.byType(GoldButton), frames: 8);
        expect(repo.lastBody, {'name': 'Marvel', 'icon': 'lamp', 'color': '#C9A84C', 'parentId': 'r5-d'});
      });

      testWidgets('subcategoría y edición: el padre viene elegido; descartar cambios pregunta (${phone.name})',
          (tester) async {
        final repo = FakeCategoriasRepo();
        await pumpPhone(tester, const AdminCategoriasScreen(), phone: phone, me: _admin, overrides: _catOv(repo: repo));
        await _openRowMenu(tester, 'Llaveros');
        await _tap(tester, find.text('Nueva subcategoría'), frames: 8);
        expectReachable(tester, find.text('Nueva subcategoría'), what: 'el título');
        expect(find.text('Llaveros'), findsOneWidget, reason: 'el padre viene elegido');
        await shoot(tester, 'catform_sub');
        await _tap(tester, find.byTooltip('Atrás'), frames: 8);
        expect(find.byType(AdminCategoryFormScreen), findsNothing, reason: 'sin cargar nada se sale directo');

        // Edición de una subcategoría con nombre y ruta largos.
        await _tap(tester, find.text('Decoración y hogar para toda la familia con un nombre bien largo'), frames: 8);
        expectReachable(tester, find.text('Editar categoría'), what: 'el título');
        expect(tester.widget<GoldButton>(find.byType(GoldButton)).onPressed, isNull);
        await shoot(tester, 'catform_edicion');
        await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Deco');
        await settle(tester, 3);
        await _tap(tester, find.byTooltip('Atrás'));
        _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
        await shoot(tester, 'catform_descartar');
        await _tap(tester, find.widgetWithText(TextButton, 'Seguir editando'));
        await _tap(tester, find.byType(GoldButton), frames: 8);
        expect(repo.calls, ['update:d']);
        expect(repo.lastBody, {'name': 'Deco'});
        expect(find.text('Categoría actualizada'), findsOneWidget);
        expectNoLayoutErrors(tester);
      });

      testWidgets('alta: salir con el nombre cargado pregunta antes de perderlo (${phone.name})', (tester) async {
        await openCreate(tester, phone);
        await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Piñatas');
        await settle(tester, 2);
        await _tap(tester, find.byTooltip('Atrás'));
        expect(find.text('¿Descartar los cambios?'), findsOneWidget);
        _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
        await _tap(tester, find.widgetWithText(TextButton, 'Descartar'), frames: 8);
        expect(find.byType(AdminCategoryFormScreen), findsNothing);
      });
    }
  });

  // =========================================================================
  // LETRA GRANDE (1,3×) EN EL TELÉFONO CHICO: cada pantalla y cada modal
  // =========================================================================
  group('Letra grande (1,3×) en el teléfono chico', () {
    const big = 1.3;
    const phone = Phone.small;

    testWidgets('productos: listado, menús, diálogos y hoja de categorías', (tester) async {
      final repo = FakeProductosRepo();
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _prod(repo: repo, options: _manyOptions));
      await shoot(tester, 'grande_prod_lista');
      await _tap(tester, find.byTooltip('Ordenar'));
      expectReachable(tester, find.text('Precio: mayor a menor'), what: 'la última opción del orden');
      await shoot(tester, 'grande_prod_menu_orden');
      await _tapOutside(tester);

      await _openRowMenu(tester, _longName);
      expectReachable(tester, find.text('Quitar de destacados'), what: 'la opción del menú');
      await shoot(tester, 'grande_prod_menu_fila');
      await _tap(tester, find.text('Eliminar'));
      _expectDialogOk(tester, confirm: 'Eliminar para siempre');
      // El aviso completo se tiene que poder leer (hasta el final).
      await tester.ensureVisible(find.textContaining('usá Archivar'));
      await tester.pump();
      expect(_isOnScreen(tester, find.textContaining('usá Archivar')), isTrue);
      await shoot(tester, 'grande_prod_dialogo_eliminar');
      await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));

      await _openRowMenu(tester, _longName);
      await _tap(tester, find.text('Archivar'));
      _expectDialogOk(tester, confirm: 'Archivar');
      await shoot(tester, 'grande_prod_dialogo_archivar');
      await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));

      await _tap(tester, find.text('Categoría'));
      _expectSheetOk(tester, 'Filtrar por categoría');
      await shoot(tester, 'grande_prod_hoja_categoria');
      await openKeyboard(tester, _inSheet(find.byType(TextField)));
      expectFocusedFieldVisible(tester);
      _expectSheetOk(tester, 'Filtrar por categoría');
      await shoot(tester, 'grande_prod_hoja_categoria_teclado');
      await closeKeyboard(tester);
      await _tapOutside(tester);

      await scrollToEnd(tester, scrollable: _mainList());
      expectReachable(tester, find.text('Ver más (52 restantes)'), what: 'el botón "Ver más"');
      await shoot(tester, 'grande_prod_lista_fin');
    });

    testWidgets('productos: estados vacío, error y sin acceso', (tester) async {
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _prod(page: _emptyPage));
      expectReachable(tester, find.text('Todavía no hay productos'), what: 'el aviso de vacío');
      await shoot(tester, 'grande_prod_vacio');
      await pumpPhone(
        tester,
        const AdminProductosScreen(),
        phone: phone,
        me: _admin,
        textScale: big,
        overrides: [
          adminProductsProvider.overrideWith(
            (ref, f) => throw ApiException('unavailable', 'No pudimos completar la operación. Probá de nuevo en unos segundos.'),
          ),
          adminProductOptionsProvider.overrideWith((ref) async => _options),
        ],
      );
      expectReachable(tester, find.byType(GoldButton), what: 'el botón "Reintentar"');
      await shoot(tester, 'grande_prod_error');
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: staffWith(['productos'], actions: const []), textScale: big, overrides: _prod());
      expectNoLayoutErrors(tester);
      await shoot(tester, 'grande_prod_sin_acceso');
    });

    testWidgets('ficha: normal, al límite y sus diálogos', (tester) async {
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _prod(detail: _extremeDetail));
      await _tap(tester, find.text('Mate Mario'), frames: 8);
      await shoot(tester, 'grande_ficha');
      final list = find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;
      final pos = tester.state<ScrollableState>(list).position;
      var n = 0;
      while (pos.pixels < pos.maxScrollExtent - 1 && n < 40) {
        pos.jumpTo((pos.pixels + 400).clamp(0, pos.maxScrollExtent));
        await tester.pump(const Duration(milliseconds: 60));
        expectNoLayoutErrors(tester, 'al recorrer la ficha con letra grande (tramo $n)');
        if (n < 3) await shoot(tester, 'grande_ficha_$n');
        n++;
      }
      await scrollToEnd(tester, scrollable: list);
      expectReachable(tester, find.textContaining('se cargan desde el panel web'), what: 'la nota final');
      await shoot(tester, 'grande_ficha_fin');

      await _reveal(tester, find.text('Eliminar'), list);
      await _tap(tester, find.text('Eliminar'));
      _expectDialogOk(tester, confirm: 'Eliminar para siempre');
      await shoot(tester, 'grande_ficha_dialogo_eliminar');
    });

    testWidgets('ficha: fotos (botones, hoja del color y confirmación de eliminar)', (tester) async {
      final repo = FakeProductosRepo();
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _prod(repo: repo, photos: FakePhotoSource()));
      await _tap(tester, find.text('Mate Mario'), frames: 8);
      final list = find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;
      final add = find.widgetWithText(OutlinedButton, 'Sumar fotos');
      await _reveal(tester, add, list);
      expectReachable(tester, add, what: 'el botón Sumar fotos con letra grande');
      // Con letra grande los dos botones no entran lado a lado: el segundo baja.
      await _reveal(tester, find.widgetWithText(OutlinedButton, 'Sacar foto'), list);
      expectReachable(tester, find.widgetWithText(OutlinedButton, 'Sacar foto'), what: 'el botón Sacar foto con letra grande');
      await shoot(tester, 'grande_ficha_fotos');
      await _reveal(tester, add, list);
      await _tap(tester, add, frames: 8);
      _expectSheetOk(tester, '¿De qué color son las fotos?');
      await shoot(tester, 'grande_ficha_fotos_color');
      await _tap(tester, _inSheet(find.text('De ninguno en particular')), frames: 8);
      expectNoLayoutErrors(tester);
      expect(repo.calls, ['image:p1:uno.jpg:-', 'image:p1:dos.jpg:-']);

      await _reveal(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'), list);
      await _tap(tester, find.widgetWithText(OutlinedButton, 'Eliminar foto'));
      expectNoLayoutErrors(tester, 'con la confirmación abierta');
      final dialog = find.byType(AlertDialog);
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Eliminar foto')),
          what: 'Eliminar foto con letra grande');
      expectReachable(tester, find.descendant(of: dialog, matching: find.widgetWithText(TextButton, 'Cancelar')),
          what: 'Cancelar con letra grande');
      await shoot(tester, 'grande_ficha_fotos_eliminar');
    });

    testWidgets('formulario de producto: teclado en primer y último campo, hojas y descartar', (tester) async {
      final repo = FakeProductosRepo(failWith: _serverCostError);
      await pumpPhone(tester, const AdminProductosScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _prod(repo: repo, options: _manyOptions));
      await _tap(tester, find.byType(FloatingActionButton), frames: 8);
      await shoot(tester, 'grande_form_alta');
      Finder field(String label) => find.widgetWithText(TextField, label);
      final formScroll =
          find.descendant(of: find.byType(AdminProductFormScreen), matching: find.byType(Scrollable)).first;

      await openKeyboard(tester, field('Nombre'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
      await shoot(tester, 'grande_form_teclado_nombre');
      await closeKeyboard(tester);
      await _reveal(tester, field('Tiempo de entrega (opcional)'), formScroll);
      await openKeyboard(tester, field('Tiempo de entrega (opcional)'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
      await shoot(tester, 'grande_form_teclado_ultimo');
      await closeKeyboard(tester);

      await _reveal(tester, find.text('Sin definir'), formScroll);
      await _tap(tester, find.text('Sin definir'));
      _expectSheetOk(tester, 'Material');
      await shoot(tester, 'grande_form_hoja_material');
      await _tap(tester, _inSheet(find.text('Material especial número 1 con nombre largo')));
      expectNoLayoutErrors(tester);

      await _reveal(tester, find.text('Elegí una categoría'), formScroll);
      await _tap(tester, find.text('Elegí una categoría'));
      _expectSheetOk(tester, 'Elegí una categoría');
      await shoot(tester, 'grande_form_hoja_categoria');
      await openKeyboard(tester, _inSheet(find.byType(TextField)));
      expectFocusedFieldVisible(tester);
      _expectSheetOk(tester, 'Elegí una categoría');
      await closeKeyboard(tester);
      await _tap(tester, _inSheet(find.text('Nivel tres con otro nombre largo que no entra en una sola línea')).first);
      expectNoLayoutErrors(tester);

      // Con todo elegido (rótulos largos en los selectores) llega al final.
      await scrollToEnd(tester, scrollable: formScroll);
      await shoot(tester, 'grande_form_fin');

      // Guardar con datos faltantes y, después, con el error largo del servidor.
      await _tap(tester, find.byType(GoldButton));
      expect(_isOnScreen(tester, find.text('Poné un nombre.')), isTrue);
      await shoot(tester, 'grande_form_validacion');
      await _reveal(tester, field('Nombre'), formScroll);
      await tester.enterText(field('Nombre'), 'Mate Luigi');
      await _reveal(tester, field('Precio'), formScroll);
      await tester.enterText(field('Precio'), '123.456.789,50');
      await settle(tester, 2);
      await _reveal(tester, field('Precio de oferta (opcional)'), formScroll);
      await openKeyboard(tester, field('Precio de oferta (opcional)'));
      await _tap(tester, find.byType(GoldButton), frames: 8);
      expect(repo.calls, ['create']);
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón para reintentar');
      await shoot(tester, 'grande_form_error_servidor');
      await closeKeyboard(tester);

      await _tap(tester, find.byTooltip('Atrás'));
      _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
      await shoot(tester, 'grande_form_descartar');
    });

    testWidgets('categorías: listado, menú, diálogos y estados', (tester) async {
      final repo = FakeCategoriasRepo();
      await pumpPhone(tester, const AdminCategoriasScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _catOv(repo: repo, data: _manyCats));
      await shoot(tester, 'grande_cat_lista');
      for (final name in [
        'Categoría principal número 1 con un nombre bastante largo para el celular',
        'Subcategoría A de la 1 con nombre largo',
        'Nivel tres con otro nombre largo que no entra en una sola línea',
        'Nivel cuatro',
      ]) {
        await tester.ensureVisible(find.text(name).first);
        await tester.pump();
        await _tap(tester, find.text(name).first, frames: 4);
        expectNoLayoutErrors(tester, 'al desplegar "$name" con letra grande');
      }
      await shoot(tester, 'grande_cat_desplegada');
      await _openRowMenu(tester, 'Nivel cinco (el más profundo de todos los niveles)');
      expectReachable(tester, find.text('Nueva subcategoría'), what: 'la opción del menú');
      await shoot(tester, 'grande_cat_menu');
      await _tap(tester, find.text('Eliminar'));
      _expectDialogOk(tester, confirm: 'Entendido', cancel: null);
      await shoot(tester, 'grande_cat_dialogo_no_borrar');
      await _tap(tester, find.widgetWithText(TextButton, 'Entendido'));
      await scrollToEnd(tester, scrollable: _mainList());
      expectReachable(tester, find.textContaining('se cambian desde el panel web'), what: 'la nota final');
      await shoot(tester, 'grande_cat_fin');

      await pumpPhone(tester, const AdminCategoriasScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _catOv(repo: repo));
      await _openRowMenu(tester, 'Mates');
      await _tap(tester, find.text('Eliminar'));
      _expectDialogOk(tester, confirm: 'Eliminar');
      await shoot(tester, 'grande_cat_dialogo_eliminar');
      await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));

      await pumpPhone(tester, const AdminCategoriasScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _catOv(data: _emptyCats));
      expectReachable(tester, find.text('Todavía no hay categorías'), what: 'el aviso de vacío');
      await shoot(tester, 'grande_cat_vacio');
    });

    testWidgets('formulario de categoría: teclado, íconos, colores, "Dentro de…" y descartar', (tester) async {
      await pumpPhone(tester, const AdminCategoriasScreen(),
          phone: phone, me: _admin, textScale: big, overrides: _catOv(data: _manyCats));
      await _tap(tester, find.byType(FloatingActionButton), frames: 8);
      await shoot(tester, 'grande_catform_alta');
      await openKeyboard(tester, find.widgetWithText(TextField, 'Nombre'));
      expectFocusedFieldVisible(tester);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón de guardar con el teclado abierto');
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Decoración y hogar para toda la familia con un nombre bien largo');
      await settle(tester, 3);
      await shoot(tester, 'grande_catform_teclado');
      await closeKeyboard(tester);

      await _tap(tester, find.text('Ninguna (categoría principal)'));
      _expectSheetOk(tester, 'Dentro de…');
      await shoot(tester, 'grande_catform_hoja_padre');
      await openKeyboard(tester, _inSheet(find.byType(TextField)));
      expectFocusedFieldVisible(tester);
      _expectSheetOk(tester, 'Dentro de…');
      await shoot(tester, 'grande_catform_hoja_padre_teclado');
      await closeKeyboard(tester);
      await _tap(tester, _inSheet(find.text('Nivel tres con otro nombre largo que no entra en una sola línea')).first);

      final formScroll =
          find.descendant(of: find.byType(AdminCategoryFormScreen), matching: find.byType(Scrollable)).first;
      await scrollToEnd(tester, scrollable: formScroll);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón "Crear categoría"');
      await shoot(tester, 'grande_catform_fin');

      await _tap(tester, find.byTooltip('Atrás'));
      _expectDialogOk(tester, confirm: 'Descartar', cancel: 'Seguir editando');
      await shoot(tester, 'grande_catform_descartar');
    });
  });

  // =========================================================================
  // LOS OTROS DOS TEMAS: pantalla principal y modales de cada módulo
  // =========================================================================
  for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
    group('Tema ${mode.name}', () {
      for (final phone in Phone.both) {
        testWidgets('productos: listado, menú, diálogo y hoja de categoría (${phone.name})', (tester) async {
          await pumpPhone(tester, const AdminProductosScreen(),
              phone: phone, me: _admin, theme: mode, overrides: _prod());
          await _tap(tester, find.text('Destacados'));
          await shoot(tester, 'tema_${mode.name}_prod_lista');
          await _openRowMenu(tester, 'Mate Mario');
          await shoot(tester, 'tema_${mode.name}_prod_menu');
          await _tap(tester, find.text('Eliminar'));
          _expectDialogOk(tester, confirm: 'Eliminar para siempre');
          await shoot(tester, 'tema_${mode.name}_prod_dialogo');
          await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));
          // Con una categoría ya elegida: la fila elegida se tiene que leer.
          await _tap(tester, find.text('Categoría'));
          await _tap(tester, _inSheet(find.text('Carteles')));
          await _tap(tester, find.text('Carteles'));
          _expectSheetOk(tester, 'Filtrar por categoría');
          await shoot(tester, 'tema_${mode.name}_prod_hoja_categoria');
        });

        testWidgets('ficha y formulario de producto con sus hojas (${phone.name})', (tester) async {
          await pumpPhone(tester, const AdminProductosScreen(),
              phone: phone, me: _admin, theme: mode, overrides: _prod());
          await _tap(tester, find.text('Mate Mario'), frames: 8);
          await shoot(tester, 'tema_${mode.name}_ficha');
          final list = find.descendant(of: find.byType(AdminProductDetailScreen), matching: find.byType(Scrollable)).first;
          await scrollToEnd(tester, scrollable: list);
          await shoot(tester, 'tema_${mode.name}_ficha_fin');
          await _tap(tester, find.byTooltip('Editar'), frames: 8);
          await shoot(tester, 'tema_${mode.name}_form');
          final formScroll =
              find.descendant(of: find.byType(AdminProductFormScreen), matching: find.byType(Scrollable)).first;
          await scrollToEnd(tester, scrollable: formScroll);
          await shoot(tester, 'tema_${mode.name}_form_fin');
          await _reveal(tester, find.text('PLA'), formScroll);
          await _tap(tester, find.text('PLA'));
          _expectSheetOk(tester, 'Material');
          await shoot(tester, 'tema_${mode.name}_form_hoja_material');
        });

        testWidgets('categorías: listado, menú, diálogo, formulario y hoja "Dentro de…" (${phone.name})',
            (tester) async {
          await pumpPhone(tester, const AdminCategoriasScreen(),
              phone: phone, me: _admin, theme: mode, overrides: _catOv());
          await _tap(tester, find.text('Figuras de colección'), frames: 4);
          await shoot(tester, 'tema_${mode.name}_cat_lista');
          await _openRowMenu(tester, 'Mates');
          await shoot(tester, 'tema_${mode.name}_cat_menu');
          await _tap(tester, find.text('Eliminar'));
          _expectDialogOk(tester, confirm: 'Eliminar');
          await shoot(tester, 'tema_${mode.name}_cat_dialogo');
          await _tap(tester, find.widgetWithText(TextButton, 'Cancelar'));
          // Edición de una subcategoría: el padre ya está elegido en la hoja.
          await _openRowMenu(tester, 'Funko Pop');
          await _tap(tester, find.text('Editar'), frames: 8);
          await shoot(tester, 'tema_${mode.name}_catform');
          await _tap(tester, find.text('Figuras de colección'));
          _expectSheetOk(tester, 'Dentro de…');
          await shoot(tester, 'tema_${mode.name}_catform_hoja_padre');
        });
      }
    });
  }
}
