import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/features/admin/productos/producto_detail_screen.dart';
import 'package:hefesto/features/admin/productos/producto_form_screen.dart';
import 'package:hefesto/features/admin/productos/productos_models.dart';
import 'package:hefesto/features/admin/productos/productos_providers.dart';
import 'package:hefesto/features/admin/productos/productos_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Dibuja las pantallas de Productos con datos de ejemplo. Sirve de humo (si algo
/// se desborda o lanza, el test falla) y, con SHOT_DIR=ruta_de_una_carpeta,
/// guarda una captura PNG de cada una para revisarlas a ojo.
final _shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

MeInfo _me({List<String> actions = const ['ver', 'crear', 'editar', 'eliminar'], String role = 'admin'}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': role,
      'isStaff': true,
      'permissions': {
        'productos': {for (final a in actions) a: true},
      },
    });

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

final _page = AdminProductsPage.fromJson({
  'items': [
    _row('p1', 'Mate Mario', sale: 24000, featured: true, isNew: true),
    _row('p2', 'Tony Tony Chopper Tamaño Real con una base personalizada y un nombre larguísimo para probar el recorte',
        price: 110000, variants: 3, category: 'Figuras de colección › Funko Pop'),
    _row('p3', 'Cartel Personalizado', status: 'draft', price: 32500, images: 0, material: null),
    _row('p4', 'Llavero Nombre', status: 'archived', price: 4500, category: null),
  ],
  'total': 57,
  'page': 1,
  'pageSize': 40,
  'totalPages': 2,
  'counts': {'total': 57, 'published': 40, 'draft': 12, 'archived': 5, 'featured': 6, 'onSale': 3},
});

final _detail = AdminProductDetail.fromJson({
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
});

final _draftDetail = AdminProductDetail.fromJson({
  ..._rawDetail(),
  'id': 'p3',
  'name': 'Cartel Personalizado',
  'status': 'draft',
  'isFeatured': false,
  'isNew': false,
  'salePrice': null,
  'isOnSale': false,
  'discountPercent': null,
  'priceFrom': false,
  'colors': <dynamic>[],
  'colorPrices': <String, dynamic>{},
  'variants': <dynamic>[],
  'images': <dynamic>[],
  'costs': null,
});

Map<String, dynamic> _rawDetail() => {
      'slug': 'cartel',
      'description': null,
      'updatedAt': '2026-10-31T12:00:00.000Z',
      'categoryId': 'c1',
      'categoryName': 'Carteles',
      'categoryPath': 'Carteles',
      'price': 32500,
      'priceMin': 32500,
      'priceMax': 32500,
      'material': 'PLA',
      'printTimeMinutes': 90,
      'weightGrams': 45,
      'colorMode': 'single',
    };

final _options = ProductOptions.fromJson({
  'categories': [
    {'id': 'f', 'name': 'Figuras de colección', 'parentId': null, 'depth': 0, 'path': 'Figuras de colección'},
    {'id': 'c-kid', 'name': 'Funko Pop', 'parentId': 'f', 'depth': 1, 'path': 'Figuras de colección › Funko Pop'},
    {'id': 'c1', 'name': 'Carteles', 'parentId': null, 'depth': 0, 'path': 'Carteles'},
  ],
  'materials': ['PETG', 'PLA'],
});

/// Repo que no sale a la red: anota lo que se le pide.
class FakeProductosRepo extends ProductosRepo {
  FakeProductosRepo() : super(ApiClient());
  final calls = <String>[];
  Map<String, dynamic>? lastPatch;
  Map<String, dynamic>? lastCreate;

  @override
  Future<void> setFeatured(String id, bool value) async => calls.add('featured:$id:$value');
  @override
  Future<void> setStatus(String id, ProductState status) async => calls.add('status:$id:${status.api}');
  @override
  Future<void> delete(String id) async => calls.add('delete:$id');
  @override
  Future<void> setPrimaryImage(String id, String imageId) async => calls.add('primary:$id:$imageId');
  @override
  Future<void> patch(String id, Map<String, dynamic> body) async {
    calls.add('patch:$id');
    lastPatch = body;
  }

  @override
  Future<String> create(Map<String, dynamic> body) async {
    calls.add('create');
    lastCreate = body;
    return 'nuevo-id';
  }
}

Future<void> _pumpFrames(WidgetTester tester, [int n = 6]) async {
  // Sin pumpAndSettle: los esqueletos animan para siempre.
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Future<void> _show(
  WidgetTester tester,
  String name,
  Widget screen, {
  double height = 880,
  MeInfo? me,
  List<Override> overrides = const [],
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(392 * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me ?? _me()),
        adminProductOptionsProvider.overrideWith((ref) async => _options),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(HefestoThemeMode.dark),
          home: screen,
        ),
      ),
    ),
  );
  await _pumpFrames(tester);
  expect(tester.takeException(), isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');

  if (_shotDir != null) {
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('$_shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    if (_shotDir != null) {
      // Solo para las capturas: tipografías de la marca e íconos de Material.
      Directory(_shotDir!).createSync(recursive: true);
      await _loadFont('Orbitron', ['assets/fonts/Orbitron-Bold.ttf', 'assets/fonts/Orbitron-ExtraBold.ttf']);
      await _loadFont('Sora', [
        'assets/fonts/Sora-Regular.ttf',
        'assets/fonts/Sora-Medium.ttf',
        'assets/fonts/Sora-SemiBold.ttf',
        'assets/fonts/Sora-Bold.ttf',
      ]);
      final root = Platform.environment['FLUTTER_ROOT'];
      if (root != null) {
        await _loadFont('MaterialIcons', ['$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf']);
      }
    }
  });

  List<Override> listOverrides({AdminProductsPage? page, FakeProductosRepo? repo}) => [
        adminProductsProvider.overrideWith((ref, f) async => page ?? _page),
        if (repo != null) productosRepoProvider.overrideWithValue(repo),
      ];

  group('Listado', () {
    testWidgets('muestra productos, estados, precios y contadores', (tester) async {
      await _show(tester, 'productos_lista', const AdminProductosScreen(),
          height: 1300, overrides: listOverrides());
      expect(find.text('Mate Mario'), findsOneWidget);
      expect(find.text('Mostrando 4 de 57 productos'), findsOneWidget);
      expect(find.text('Todos (57)'), findsOneWidget);
      expect(find.text('Activos (40)'), findsOneWidget);
      expect(find.text('Borradores (12)'), findsOneWidget);
      expect(find.text('Destacado'), findsOneWidget);
      expect(find.text('-20%'), findsOneWidget, reason: 'oferta de 30.000 a 24.000');
      expect(find.text('Sin fotos'), findsWidgets);
      expect(find.text('Borrador'), findsOneWidget);
      expect(find.text('Archivado'), findsOneWidget);
      expect(find.text('3 tamaños'), findsOneWidget);
      expect(find.text('Ver más (53 restantes)'), findsOneWidget);
      expect(find.text('Nuevo'), findsWidgets, reason: 'botón flotante + chip');
    });

    testWidgets('a 360dp de ancho y con fuente grande no se desborda', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.6;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      tester.view.devicePixelRatio = 2.75;
      tester.view.physicalSize = Size(360 * 2.75, 800 * 2.75);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
            meProvider.overrideWith((ref) async => _me()),
            adminProductOptionsProvider.overrideWith((ref) async => _options),
            ...listOverrides(),
          ],
          child: MaterialApp(
            theme: AppTheme.of(HefestoThemeMode.warm),
            home: const AdminProductosScreen(),
          ),
        ),
      );
      await _pumpFrames(tester);
      expect(tester.takeException(), isNull);
      expect(find.text('Mate Mario'), findsOneWidget);
    });

    testWidgets('lista vacía con filtros ofrece quitarlos; sin productos, crear', (tester) async {
      final empty = AdminProductsPage.fromJson({'items': <dynamic>[], 'total': 0, 'counts': {}});
      await _show(tester, 'productos_vacio', const AdminProductosScreen(),
          overrides: listOverrides(page: empty));
      expect(find.text('Todavía no hay productos'), findsOneWidget);
      expect(find.textContaining('Tocá "Nuevo"'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra con "Reintentar"', (tester) async {
      await _show(
        tester,
        'productos_error',
        const AdminProductosScreen(),
        overrides: [adminProductsProvider.overrideWith((ref, f) => throw ApiException('unavailable', 'El servidor no responde.'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
      expect(find.text('El servidor no responde.'), findsOneWidget);
    });

    testWidgets('sin permiso de productos se muestra "Sin acceso"', (tester) async {
      await _show(
        tester,
        'productos_sin_acceso',
        const AdminProductosScreen(),
        me: MeInfo.fromJson({
          'id': 'u3',
          'role': 'operator',
          'isStaff': true,
          'permissions': {
            'productos': {'ver': false},
          },
        }),
        overrides: listOverrides(),
      );
      expect(find.text('Sin acceso'), findsOneWidget);
    });

    testWidgets('un operador solo-lectura no ve el botón Nuevo ni acciones', (tester) async {
      await _show(
        tester,
        'productos_solo_lectura',
        const AdminProductosScreen(),
        me: _me(actions: ['ver'], role: 'operator'),
        overrides: listOverrides(),
      );
      expect(find.text('Mate Mario'), findsOneWidget);
      expect(find.widgetWithText(FloatingActionButton, 'Nuevo'), findsNothing);
      expect(find.byIcon(Icons.more_vert_rounded), findsNothing);
    });

    testWidgets('destacar y archivar desde el menú de la fila', (tester) async {
      final repo = FakeProductosRepo();
      await _show(tester, 'productos_menu', const AdminProductosScreen(), overrides: listOverrides(repo: repo));

      // Destacar el segundo producto (el primero ya está destacado).
      await tester.tap(find.byIcon(Icons.more_vert_rounded).at(1));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Destacar'));
      await _pumpFrames(tester);
      expect(repo.calls, ['featured:p2:true']);
      expect(find.text('Producto destacado'), findsOneWidget);

      // Archivar el primero: pide confirmación.
      await tester.tap(find.byIcon(Icons.more_vert_rounded).at(0));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Archivar'));
      await _pumpFrames(tester, 3);
      expect(find.text('¿Archivar "Mate Mario"?'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await _pumpFrames(tester, 3);
      expect(repo.calls, hasLength(1), reason: 'cancelar no archiva');

      await tester.tap(find.byIcon(Icons.more_vert_rounded).at(0));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Archivar'));
      await _pumpFrames(tester, 3);
      await tester.tap(find.widgetWithText(TextButton, 'Archivar'));
      await _pumpFrames(tester);
      expect(repo.calls.last, 'status:p1:archived');
      expect(tester.takeException(), isNull);
    });

    testWidgets('publicar un borrador sin fotos avisa y no llama al servidor', (tester) async {
      final repo = FakeProductosRepo();
      await _show(tester, 'productos_publicar_sin_fotos', const AdminProductosScreen(),
          overrides: listOverrides(repo: repo));
      await tester.tap(find.byIcon(Icons.more_vert_rounded).at(2));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Publicar'));
      await _pumpFrames(tester);
      expect(find.textContaining('sin fotos'), findsWidgets);
      expect(repo.calls, isEmpty);
    });

    testWidgets('eliminar pide confirmación con el aviso de que es para siempre', (tester) async {
      final repo = FakeProductosRepo();
      await _show(tester, 'productos_eliminar', const AdminProductosScreen(), overrides: listOverrides(repo: repo));
      await tester.tap(find.byIcon(Icons.more_vert_rounded).at(0));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Eliminar'));
      await _pumpFrames(tester, 3);
      expect(find.textContaining('para siempre'), findsWidgets);
      expect(find.textContaining('conservan su registro'), findsOneWidget);
      await tester.tap(find.text('Eliminar para siempre').last);
      await _pumpFrames(tester);
      expect(repo.calls, ['delete:p1']);
    });
  });

  group('Ficha', () {
    testWidgets('producto completo (admin): precios, datos, colores, tamaños y costos', (tester) async {
      await _show(
        tester,
        'producto_detalle',
        const AdminProductDetailScreen(id: 'p1', initialName: 'Mate Mario'),
        height: 2400,
        overrides: [adminProductProvider.overrideWith((ref, id) async => _detail)],
      );
      expect(find.text('Mate Mario'), findsWidgets);
      expect(find.text('Figuras de colección › Funko Pop'), findsOneWidget);
      expect(find.text('5 h 30 min'), findsOneWidget);
      expect(find.textContaining('entre \$20.000 y \$38.000'), findsOneWidget);
      expect(find.text('TAMAÑOS (2)'), findsOneWidget);
      expect(find.text('Chico 10 cm'), findsOneWidget);
      expect(find.text('COSTOS'), findsOneWidget);
      expect(find.text('Quitar destacado'), findsOneWidget);
      expect(find.text('Archivar'), findsOneWidget);
      expect(find.text('Ver en la tienda'), findsOneWidget);
      expect(find.text('Eliminar'), findsOneWidget);
      // La portada es la 1ª; elegir otra foto ofrece "Usar como portada".
      expect(find.text('Usar como portada'), findsNothing);
    });

    testWidgets('elegir otra foto como portada llama al servidor', (tester) async {
      final repo = FakeProductosRepo();
      await _show(
        tester,
        'producto_portada',
        const AdminProductDetailScreen(id: 'p1'),
        height: 1200,
        overrides: [
          adminProductProvider.overrideWith((ref, id) async => _detail),
          productosRepoProvider.overrideWithValue(repo),
        ],
      );
      // Miniaturas: tocar la segunda (no es la portada).
      final thumbs = find.byType(GestureDetector);
      expect(thumbs, findsWidgets);
      await tester.tap(find.byType(NetImage).at(2)); // 0 = grande, 1 = 1ª miniatura, 2 = 2ª
      await _pumpFrames(tester, 3);
      expect(find.text('Usar como portada'), findsOneWidget);
      await tester.tap(find.text('Usar como portada'));
      await _pumpFrames(tester);
      expect(repo.calls, ['primary:p1:i2']);
    });

    testWidgets('borrador sin fotos: se puede publicar (aviso) y no hay costos', (tester) async {
      await _show(
        tester,
        'producto_borrador_sin_fotos',
        const AdminProductDetailScreen(id: 'p3'),
        height: 1100,
        overrides: [adminProductProvider.overrideWith((ref, id) async => _draftDetail)],
      );
      expect(find.text('Sin fotos'), findsWidgets);
      expect(find.text('Publicar'), findsOneWidget);
      expect(find.text('COSTOS'), findsNothing);
      expect(find.text('Ver en la tienda'), findsNothing);
    });

    testWidgets('un operador sin "eliminar" no ve Archivar ni Eliminar', (tester) async {
      await _show(
        tester,
        'producto_operador',
        const AdminProductDetailScreen(id: 'p1'),
        height: 2400,
        me: _me(actions: ['ver', 'editar'], role: 'operator'),
        overrides: [adminProductProvider.overrideWith((ref, id) async => _detail)],
      );
      expect(find.text('Archivar'), findsNothing);
      expect(find.text('Eliminar'), findsNothing);
      expect(find.text('Quitar destacado'), findsOneWidget);
    });

    testWidgets('error al cargar la ficha', (tester) async {
      await _show(
        tester,
        'producto_error',
        const AdminProductDetailScreen(id: 'zzz'),
        overrides: [
          adminProductProvider.overrideWith((ref, id) => throw ApiException('not_found', 'No encontramos el producto.')),
        ],
      );
      expect(find.text('No encontramos el producto.'), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    });
  });

  group('Formulario', () {
    testWidgets('alta: avisa que nace como borrador y valida antes de mandar', (tester) async {
      final repo = FakeProductosRepo();
      await _show(
        tester,
        'producto_alta',
        const AdminProductFormScreen(),
        height: 1500,
        overrides: [productosRepoProvider.overrideWithValue(repo)],
      );
      expect(find.textContaining('como borrador'), findsOneWidget);
      expect(find.text('Crear producto'), findsOneWidget);

      // Vacío: marca los campos obligatorios y NO llama al servidor.
      await tester.ensureVisible(find.text('Crear producto'));
      await tester.tap(find.text('Crear producto'));
      await _pumpFrames(tester, 3);
      expect(find.text('Poné un nombre.'), findsOneWidget);
      expect(find.text('Elegí una categoría.'), findsOneWidget);
      expect(find.text('Poné un precio mayor a 0.'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets('alta completa manda el body esperado y vuelve con el id', (tester) async {
      final repo = FakeProductosRepo();
      String? popped;
      await _show(
        tester,
        'producto_alta_completa',
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () async {
                  popped = await Navigator.of(context).push<String>(
                    MaterialPageRoute(builder: (_) => const AdminProductFormScreen()),
                  );
                },
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
        height: 1500,
        overrides: [productosRepoProvider.overrideWithValue(repo)],
      );
      await tester.tap(find.text('abrir'));
      await _pumpFrames(tester, 8);

      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Mate Luigi');
      await tester.enterText(find.widgetWithText(TextField, 'Precio'), '25.000');
      await tester.enterText(find.widgetWithText(TextField, 'Gramos'), '90');
      await tester.enterText(find.widgetWithText(TextField, 'Tiempo (min)'), '180');

      // Categoría: abre la hoja y elige la subcategoría.
      await tester.tap(find.text('Elegí una categoría'));
      await _pumpFrames(tester, 8);
      expect(find.text('Funko Pop'), findsOneWidget);
      await tester.tap(find.text('Funko Pop'));
      await _pumpFrames(tester, 8);

      // Material.
      await tester.tap(find.text('Sin definir'));
      await _pumpFrames(tester, 8);
      await tester.tap(find.text('PLA'));
      await _pumpFrames(tester, 8);

      await tester.ensureVisible(find.text('Crear producto'));
      await tester.tap(find.text('Crear producto'));
      await _pumpFrames(tester, 10);

      expect(repo.lastCreate, {
        'name': 'Mate Luigi',
        'categoryId': 'c-kid',
        'price': 25000.0,
        'material': 'PLA',
        'weightGrams': 90,
        'printTimeMinutes': 180,
        'isFeatured': false,
      });
      expect(popped, 'nuevo-id');
      expect(tester.takeException(), isNull);
    });

    testWidgets('edición: "Guardar" apagado hasta que cambia algo; manda solo el cambio', (tester) async {
      final repo = FakeProductosRepo();
      await _show(
        tester,
        'producto_edicion',
        AdminProductFormScreen(product: _detail),
        height: 1500,
        overrides: [productosRepoProvider.overrideWithValue(repo)],
      );
      GoldButton button() => tester.widget<GoldButton>(find.byType(GoldButton));
      expect(find.text('Guardar cambios'), findsOneWidget);
      expect(button().onPressed, isNull, reason: 'sin cambios no se puede guardar');

      await tester.enterText(find.widgetWithText(TextField, 'Precio'), '35000');
      await _pumpFrames(tester, 3);
      expect(button().onPressed, isNotNull);

      // Volver al valor original apaga el botón otra vez.
      await tester.enterText(find.widgetWithText(TextField, 'Precio'), '30000');
      await _pumpFrames(tester, 3);
      expect(button().onPressed, isNull);

      await tester.enterText(find.widgetWithText(TextField, 'Precio'), '35000');
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Guardar cambios'));
      await _pumpFrames(tester, 8);
      expect(repo.calls, ['patch:p1']);
      expect(repo.lastPatch, {'price': 35000.0});
    });

    testWidgets('edición: una oferta mayor al precio se marca sin llamar al servidor', (tester) async {
      final repo = FakeProductosRepo();
      await _show(
        tester,
        'producto_edicion_oferta',
        AdminProductFormScreen(product: _detail),
        height: 1500,
        overrides: [productosRepoProvider.overrideWithValue(repo)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Precio de oferta (opcional)'), '40000');
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Guardar cambios'));
      await _pumpFrames(tester, 3);
      expect(find.text('La oferta tiene que ser menor al precio.'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets('un error del servidor se muestra en línea y deja reintentar', (tester) async {
      final repo = _FailingRepo();
      await _show(
        tester,
        'producto_error_servidor',
        AdminProductFormScreen(product: _detail),
        height: 1500,
        overrides: [productosRepoProvider.overrideWithValue(repo)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Otro nombre');
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Guardar cambios'));
      await _pumpFrames(tester, 8);
      expect(find.text('No pudimos calcular el costo de producción.'), findsOneWidget);
      expect(tester.widget<GoldButton>(find.byType(GoldButton)).onPressed, isNotNull);
    });
  });
}

class _FailingRepo extends FakeProductosRepo {
  @override
  Future<void> patch(String id, Map<String, dynamic> body) async {
    throw ApiException('invalid', 'No pudimos calcular el costo de producción.', status: 422);
  }
}
