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
import 'package:hefesto/features/admin/categorias/categoria_form_screen.dart';
import 'package:hefesto/features/admin/categorias/categorias_models.dart';
import 'package:hefesto/features/admin/categorias/categorias_providers.dart';
import 'package:hefesto/features/admin/categorias/categorias_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Dibuja las pantallas de Categorías con datos de ejemplo. Sirve de humo (si algo
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
      'role': role,
      'isStaff': true,
      'permissions': {
        'productos': {for (final a in actions) a: true},
      },
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

final _data = AdminCategoriesData.fromJson({
  'items': [
    _cat('f', 'Figuras de colección', products: 2, total: 9, children: 2, descendants: 3, icon: 'star', color: '#9B7BD4'),
    _cat('fp', 'Funko Pop',
        parentId: 'f', depth: 1, path: 'Figuras de colección › Funko Pop', products: 3, total: 7, children: 1, descendants: 1, icon: 'gamepad'),
    _cat('sh', 'Superhéroes',
        parentId: 'fp', depth: 2, path: 'Figuras de colección › Funko Pop › Superhéroes', products: 4, total: 4),
    _cat('an', 'Anime', parentId: 'f', depth: 1, path: 'Figuras de colección › Anime', products: 0, total: 0),
    _cat('l', 'Llaveros', products: 5, total: 5, icon: 'key', color: '#5A9CD9'),
    _cat('d', 'Decoración y hogar para toda la familia con un nombre bien largo', products: 1, total: 1, icon: 'home', color: '#4CB782'),
    _cat('m', 'Mates', products: 0, total: 0, icon: null, color: null),
  ],
  'summary': {'total': 7, 'roots': 4, 'subcategories': 3, 'productsCategorized': 12},
});

class FakeCategoriasRepo extends CategoriasRepo {
  FakeCategoriasRepo() : super(ApiClient());
  final calls = <String>[];
  Map<String, dynamic>? lastBody;

  @override
  Future<String> create(Map<String, dynamic> body) async {
    calls.add('create');
    lastBody = body;
    return 'nueva';
  }

  @override
  Future<void> update(String id, Map<String, dynamic> body) async {
    calls.add('update:$id');
    lastBody = body;
  }

  @override
  Future<void> delete(String id) async => calls.add('delete:$id');
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

  List<Override> listOverrides([FakeCategoriasRepo? repo, AdminCategoriesData? data]) => [
        adminCategoriesProvider.overrideWith((ref) async => data ?? _data),
        if (repo != null) categoriasRepoProvider.overrideWithValue(repo),
      ];

  group('Listado en árbol', () {
    testWidgets('arranca plegado: solo las principales, con contadores', (tester) async {
      await _show(tester, 'categorias_arbol', const AdminCategoriasScreen(), overrides: listOverrides());
      expect(find.text('Figuras de colección'), findsOneWidget);
      expect(find.text('Llaveros'), findsOneWidget);
      expect(find.text('Funko Pop'), findsNothing, reason: 'las subcategorías están plegadas');
      expect(find.text('9 productos · 2 sub'), findsOneWidget, reason: 'el padre suma toda su descendencia');
      expect(find.text('Mates'), findsOneWidget);
      // Contadores del resumen (categorías / subcategorías / productos).
      expect(find.text('4'), findsOneWidget);
      expect(find.text('12'), findsOneWidget);
    });

    testWidgets('tocar una categoría con hijas la despliega, nivel por nivel', (tester) async {
      await _show(tester, 'categorias_desplegada', const AdminCategoriasScreen(), height: 1100, overrides: listOverrides());
      await tester.tap(find.text('Figuras de colección'));
      await _pumpFrames(tester, 3);
      expect(find.text('Funko Pop'), findsOneWidget);
      expect(find.text('Anime'), findsOneWidget);
      expect(find.text('Superhéroes'), findsNothing, reason: 'la nieta sigue plegada');
      await tester.tap(find.text('Funko Pop'));
      await _pumpFrames(tester, 3);
      expect(find.text('Superhéroes'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('buscar encuentra una subcategoría escondida y muestra su ruta', (tester) async {
      await _show(tester, 'categorias_busqueda', const AdminCategoriasScreen(), overrides: listOverrides());
      await tester.enterText(find.byType(TextField), 'super');
      await _pumpFrames(tester, 3);
      expect(find.text('Superhéroes'), findsOneWidget);
      expect(find.text('Figuras de colección › Funko Pop › Superhéroes'), findsOneWidget);
      expect(find.text('Llaveros'), findsNothing);
      await tester.enterText(find.byType(TextField), 'zzzz');
      await _pumpFrames(tester, 3);
      expect(find.text('Sin resultados'), findsOneWidget);
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
            ...listOverrides(),
          ],
          child: MaterialApp(
            theme: AppTheme.of(HefestoThemeMode.light),
            home: const AdminCategoriasScreen(),
          ),
        ),
      );
      await _pumpFrames(tester);
      await tester.tap(find.text('Figuras de colección'));
      await _pumpFrames(tester, 3);
      expect(tester.takeException(), isNull);
    });

    testWidgets('sin categorías y con error del servidor', (tester) async {
      final empty = AdminCategoriesData.fromJson({'items': <dynamic>[]});
      await _show(tester, 'categorias_vacio', const AdminCategoriasScreen(), overrides: listOverrides(null, empty));
      expect(find.text('Todavía no hay categorías'), findsOneWidget);
      expect(find.textContaining('Tocá "Nueva"'), findsOneWidget);
    });

    testWidgets('un error del servidor se muestra con "Reintentar"', (tester) async {
      await _show(
        tester,
        'categorias_error',
        const AdminCategoriasScreen(),
        overrides: [adminCategoriesProvider.overrideWith((ref) => throw ApiException('unavailable', 'Sin conexión.'))],
      );
      expect(find.text('Reintentar'), findsOneWidget);
      expect(find.text('Sin conexión.'), findsOneWidget);
    });

    testWidgets('sin permiso de productos se muestra "Sin acceso"', (tester) async {
      await _show(
        tester,
        'categorias_sin_acceso',
        const AdminCategoriasScreen(),
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

    testWidgets('un operador solo-lectura no ve "Nueva" ni acciones', (tester) async {
      await _show(
        tester,
        'categorias_solo_lectura',
        const AdminCategoriasScreen(),
        me: _me(actions: ['ver'], role: 'operator'),
        overrides: listOverrides(),
      );
      expect(find.text('Llaveros'), findsOneWidget);
      expect(find.widgetWithText(FloatingActionButton, 'Nueva'), findsNothing);
      expect(find.byIcon(Icons.more_vert_rounded), findsNothing);
    });
  });

  group('Eliminar (mismas reglas que la web)', () {
    Future<void> openMenu(WidgetTester tester, String categoryName, String item) async {
      final tile = find.ancestor(of: find.text(categoryName), matching: find.byType(Row)).first;
      await tester.tap(find.descendant(of: tile, matching: find.byIcon(Icons.more_vert_rounded)).first);
      await _pumpFrames(tester, 3);
      await tester.tap(find.text(item));
      await _pumpFrames(tester, 3);
    }

    testWidgets('con productos no se puede: explica el motivo y no llama al servidor', (tester) async {
      final repo = FakeCategoriasRepo();
      await _show(tester, 'categorias_no_borrar', const AdminCategoriasScreen(), overrides: listOverrides(repo));
      await openMenu(tester, 'Llaveros', 'Eliminar');
      expect(find.text('No se puede borrar "Llaveros"'), findsOneWidget);
      expect(find.textContaining('Tiene 5 productos'), findsOneWidget);
      await tester.tap(find.text('Entendido'));
      await _pumpFrames(tester, 3);
      expect(repo.calls, isEmpty);
    });

    testWidgets('con subcategorías tampoco', (tester) async {
      final repo = FakeCategoriasRepo();
      final data = AdminCategoriesData.fromJson({
        'items': [
          _cat('p', 'Padre', products: 0, total: 0, children: 2, descendants: 2),
        ],
      });
      await _show(tester, 'categorias_con_hijas', const AdminCategoriasScreen(), overrides: listOverrides(repo, data));
      await openMenu(tester, 'Padre', 'Eliminar');
      expect(find.textContaining('Tiene 2 subcategorías'), findsOneWidget);
      expect(repo.calls, isEmpty);
    });

    testWidgets('vacía: pide confirmar y borra', (tester) async {
      final repo = FakeCategoriasRepo();
      await _show(tester, 'categorias_borrar', const AdminCategoriasScreen(), overrides: listOverrides(repo));
      await openMenu(tester, 'Mates', 'Eliminar');
      expect(find.text('¿Eliminar "Mates"?'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Eliminar'));
      await _pumpFrames(tester);
      expect(repo.calls, ['delete:m']);
      expect(find.text('Categoría eliminada'), findsOneWidget);
    });
  });

  group('Formulario', () {
    testWidgets('alta de categoría principal: valida el nombre y manda el body', (tester) async {
      final repo = FakeCategoriasRepo();
      await _show(
        tester,
        'categoria_alta',
        AdminCategoryFormScreen(all: _data.items),
        height: 1100,
        overrides: [categoriasRepoProvider.overrideWithValue(repo)],
      );
      expect(find.text('Nueva categoría'), findsOneWidget);
      await tester.tap(find.text('Crear categoría'));
      await _pumpFrames(tester, 3);
      expect(find.text('Poné un nombre.'), findsOneWidget);
      expect(repo.calls, isEmpty);

      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Piñatas');
      await _pumpFrames(tester, 3);
      // Elegir ícono y color (las casillas se anuncian en castellano, no con la
      // clave interna "gift" ni con el código del color).
      await tester.tap(find.byTooltip('Regalo'));
      await tester.tap(find.byTooltip('Azul'));
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Crear categoría'));
      await _pumpFrames(tester, 8);
      expect(repo.lastBody, {'name': 'Piñatas', 'icon': 'gift', 'color': '#5A9CD9'});
    });

    testWidgets('alta de subcategoría: el padre viene elegido', (tester) async {
      final repo = FakeCategoriasRepo();
      await _show(
        tester,
        'categoria_alta_sub',
        AdminCategoryFormScreen(all: _data.items, initialParentId: 'f'),
        height: 1100,
        overrides: [categoriasRepoProvider.overrideWithValue(repo)],
      );
      expect(find.text('Nueva subcategoría'), findsOneWidget);
      expect(find.text('Figuras de colección'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Marvel');
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Crear categoría'));
      await _pumpFrames(tester, 8);
      expect(repo.lastBody?['parentId'], 'f');
      expect(repo.lastBody?['name'], 'Marvel');
    });

    testWidgets('edición: "Guardar" apagado sin cambios; manda solo lo que cambió', (tester) async {
      final repo = FakeCategoriasRepo();
      final funko = _data.items.firstWhere((c) => c.id == 'fp');
      await _show(
        tester,
        'categoria_edicion',
        AdminCategoryFormScreen(all: _data.items, category: funko),
        height: 1100,
        overrides: [categoriasRepoProvider.overrideWithValue(repo)],
      );
      GoldButton button() => tester.widget<GoldButton>(find.byType(GoldButton));
      expect(find.text('Guardar cambios'), findsOneWidget);
      expect(button().onPressed, isNull);

      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Funkos');
      await _pumpFrames(tester, 3);
      expect(button().onPressed, isNotNull);
      await tester.tap(find.text('Guardar cambios'));
      await _pumpFrames(tester, 8);
      expect(repo.calls, ['update:fp']);
      expect(repo.lastBody, {'name': 'Funkos'});
    });

    testWidgets('al elegir padre no ofrece la propia categoría ni su descendencia', (tester) async {
      await _show(
        tester,
        'categoria_padre',
        AdminCategoryFormScreen(all: _data.items, category: _data.items.firstWhere((c) => c.id == 'f')),
        height: 1100,
        overrides: [categoriasRepoProvider.overrideWithValue(FakeCategoriasRepo())],
      );
      await tester.tap(find.text('Ninguna (categoría principal)').first);
      await _pumpFrames(tester, 8);
      // "Figuras de colección" y todo lo que cuelga de ella queda fuera.
      expect(find.text('Llaveros'), findsOneWidget);
      expect(find.text('Funko Pop'), findsNothing);
      expect(find.text('Superhéroes'), findsNothing);
      expect(find.text('Anime'), findsNothing);
    });

    testWidgets('un error del servidor se muestra en línea', (tester) async {
      final repo = _FailingRepo();
      await _show(
        tester,
        'categoria_error',
        AdminCategoryFormScreen(all: _data.items),
        height: 1100,
        overrides: [categoriasRepoProvider.overrideWithValue(repo)],
      );
      await tester.enterText(find.widgetWithText(TextField, 'Nombre'), 'Llaveros');
      await _pumpFrames(tester, 3);
      await tester.tap(find.text('Crear categoría'));
      await _pumpFrames(tester, 8);
      expect(find.text('Ya existe una categoría con ese nombre o slug.'), findsOneWidget);
      expect(tester.widget<GoldButton>(find.byType(GoldButton)).onPressed, isNotNull);
    });
  });
}

class _FailingRepo extends FakeCategoriasRepo {
  @override
  Future<String> create(Map<String, dynamic> body) async {
    throw ApiException('invalid', 'Ya existe una categoría con ese nombre o slug.', status: 422);
  }
}
