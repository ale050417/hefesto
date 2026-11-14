// La TIENDA (inicio, catálogo, producto, favoritos, cuenta, ingreso) en
// condiciones de teléfono real: tamaño chico e iPhone, teclado abierto, letra
// grande, los tres temas y datos con la forma de los reales (2026-11-14,
// pedido de Ale: que ninguna pantalla ni modal se vea roto).
// Con SHOT_DIR=carpeta guarda una captura de cada estado.

import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/core/api/models.dart';
import 'package:hefesto/core/config.dart';
import 'package:hefesto/core/providers.dart';
import 'package:hefesto/core/theme/app_theme.dart';
import 'package:hefesto/core/widgets/common.dart';
import 'package:hefesto/core/widgets/product_card.dart';
import 'package:hefesto/features/account/account_screen.dart';
import 'package:hefesto/features/auth/auth_repository.dart';
import 'package:hefesto/features/auth/login_screen.dart';
import 'package:hefesto/features/auth/new_password_screen.dart';
import 'package:hefesto/features/auth/register_screen.dart';
import 'package:hefesto/features/catalog/catalog_screen.dart';
import 'package:hefesto/features/favorites/favorites_screen.dart';
import 'package:hefesto/features/home/home_screen.dart';
import 'package:hefesto/features/product/product_screen.dart';
import 'package:hefesto/router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthState, Session;

import 'support/device_kit.dart';

// --- Datos con la forma de los reales (nombres largos incluidos) -----------

Map<String, dynamic> _product(
  String slug,
  String name, {
  num price = 2500,
  bool priceFrom = false,
  bool onSale = false,
  bool isNew = false,
  String category = 'Llaveros',
}) =>
    {
      'id': 'id-$slug',
      'name': name,
      'slug': slug,
      'price': onSale ? price * 1.25 : price,
      'salePrice': onSale ? price : null,
      'displayPrice': price,
      'priceFrom': priceFrom,
      'saleApplies': onSale,
      'discountPercent': onSale ? 20 : null,
      'needsChoice': true,
      'lineColor': null,
      'isNew': isNew,
      'isFeatured': false,
      'material': 'PLA',
      'category': {'name': category, 'slug': category.toLowerCase()},
      // Sin foto: en los tests no hay red (se ve el marcador de la marca).
      'primaryImage': null,
    };

final _catalog = <Map<String, dynamic>>[
  _product('gemas-raven', 'Gemas del cinturón de Raven de Jóvenes Titanes', price: 8500, isNew: true, category: 'Cosplay'),
  _product('mini-jesus', 'Mini Jesús – Sentado en el monitor o estante', price: 4500, category: 'Figuras'),
  _product('chopper', 'Tony Tony Chopper | Tamaño Real', price: 110000, category: 'Figuras'),
  _product('kit-reglas', 'Kit de reglas de encuadernación', price: 2000, priceFrom: true, category: 'Herramientas'),
  _product('organizador', 'Organizador con dos cajones', price: 62500, onSale: true, priceFrom: true, category: 'Organizador y Almacenamiento'),
  _product('huella', 'Huella de dinosaurio', category: 'Llaveros'),
  _product('porta-cepillo', 'Porta cepillo de pestañas con corazones', price: 3200, isNew: true, onSale: true, category: 'Maquillaje'),
  _product('parlamento', 'Parlamento de canada', price: 90000, category: 'Monumentos y arquitectura'),
];

final _categories = [
  for (final (i, n) in const [
    'Armas', 'Chop', 'Cosplay', 'Decoración', 'Educación', 'Juegos de mesa', 'Maquillaje',
    'Monumentos y arquitectura', 'Tecnología', 'Llaveros', 'Figuras', 'Hogar y Cocina',
  ].indexed)
    {'id': 'c$i', 'name': n, 'slug': 'cat-$i', 'parentId': null, 'productCount': i + 1, 'imageUrl': null},
];

HomeData _home({String mode = 'vidriera'}) => HomeData.fromJson({
      'brand': {
        'storeName': 'Hefesto3D',
        'slogan': 'Forjado en capas',
        'logoUrl': null,
        'whatsapp': '+54 3757 624148',
        'instagram': '@hefesto.3d_',
        'contactEmail': 'hola@example.com',
        'businessMode': mode,
        'bannerIntervalSec': 5,
      },
      'banners': [
        {'id': 'b1', 'title': 'WORLD CUP', 'subtitle': 'Tamaño real', 'imageUrl': null, 'position': '78% 0%', 'align': 'left'},
        {'id': 'b2', 'title': 'MARIO BROS', 'subtitle': 'Figura decorativa', 'imageUrl': null, 'position': '29% 0%', 'align': 'left'},
      ],
      'stats': {'pieces': 281, 'customers': 74},
      'categories': _categories,
      // A propósito, productos repetidos entre secciones (y con el catálogo).
      'featured': _catalog.sublist(0, 4),
      'latest': _catalog.sublist(2, 8),
      'onSale': [_catalog[4], _catalog[6]],
    });

final _detailJson = <String, dynamic>{
  ..._product('kit-reglas', 'Kit de reglas de encuadernación', price: 2000, priceFrom: true, category: 'Herramientas'),
  'description': '¡Lográ terminaciones perfectas y profesionales en todos tus proyectos de encuadernación y '
      'papelería creativa!\nEste práctico set de plantillas de alineación es la herramienta ideal para '
      'encuadernadores, emprendedores y amantes del scrapbooking.',
  'weightGrams': 15,
  'dimensions': null,
  'productionTime': '48h',
  'colorMode': 'single',
  'colors': [
    'Amarillo', 'Amarillo Girasol', 'Azul', 'Beige', 'Blanco', 'Bronce', 'Celeste', 'Cian', 'Fucsia', 'Gris',
    'Gris Plata', 'Lila', 'Marron', 'Marron Matte', 'Morado', 'Naranja', 'Negro', 'Rojo', 'Rosa fluor', 'Rosa',
    'Uva', 'Verde', 'Verde agua',
  ],
  'colorPrices': <String, dynamic>{},
  'images': <dynamic>[],
  'variants': [
    {'id': 'v1', 'label': '3 x 3 pulgadas (aproximadamente 7,6 x 7,6 cm)', 'price': 2000, 'colorPrices': <String, dynamic>{}},
    {'id': 'v2', 'label': '3 x 4 pulgadas (aproximadamente 7,6 x 10,1 cm)', 'price': 2500, 'colorPrices': <String, dynamic>{}},
    {'id': 'v3', 'label': '3 x 5 pulgadas (aproximadamente 7,6 x 12,7 cm)', 'price': 3000, 'colorPrices': <String, dynamic>{}},
  ],
};

/// API de mentira de la tienda.
class _FakeApi extends ApiClient {
  _FakeApi({this.deleteError});

  final ApiException? deleteError;
  int deleteCalls = 0;
  final List<({String? q, String? material, double? maxPrice, bool? onSale})> searches = [];

  @override
  Future<CatalogPage> products({
    String? q,
    String? category,
    String? material,
    double? minPrice,
    double? maxPrice,
    bool? onSale,
    bool? isNew,
    String sort = 'newest',
    int page = 1,
    int pageSize = 12,
    bool facets = false,
  }) async {
    searches.add((q: q, material: material, maxPrice: maxPrice, onSale: onSale));
    final items = (q ?? '').contains('zzz') ? <Map<String, dynamic>>[] : _catalog;
    return CatalogPage.fromJson({
      'items': items,
      'total': items.length,
      'page': 1,
      'totalPages': 1,
      if (facets)
        'facets': {
          'categories': _categories,
          'materials': ['PETG', 'PLA'],
          'priceMax': 110000,
        },
    });
  }

  @override
  Future<({ProductDetail product, List<Product> related})> product(String slug) async => (
        product: ProductDetail.fromJson({..._detailJson, 'slug': slug, 'id': 'id-$slug'}),
        related: [for (final p in _catalog.sublist(0, 4)) Product.fromJson(p)],
      );

  @override
  Future<void> deleteAccount() async {
    deleteCalls++;
    if (deleteError != null) throw deleteError!;
  }
}

class _FakeAuth extends AuthRepository {
  int signOuts = 0;
  String? newPassword;
  final List<String> signIns = [];

  @override
  Future<void> signIn(String email, String password) async => signIns.add(email);

  @override
  Future<bool> signUp({required String fullName, required String email, required String password}) async => true;

  @override
  Future<void> resetPassword(String email) async {}

  @override
  Future<void> updatePassword(String password) async => newPassword = password;

  @override
  Future<void> signOut() async => signOuts++;
}

final _session = Session.fromJson({
  'access_token': 'token',
  'token_type': 'bearer',
  'user': {
    'id': 'u1',
    'app_metadata': <String, dynamic>{},
    'user_metadata': <String, dynamic>{},
    'aud': 'authenticated',
    'created_at': '2026-01-01T00:00:00Z',
    'email': 'cliente@example.com',
  },
})!;

final _customer = MeInfo.fromJson({'id': 'u1', 'email': 'cliente@example.com', 'fullName': 'Juana Cliente', 'role': 'customer', 'isStaff': false});

late SharedPreferences _prefs;

/// Overrides comunes de la tienda (sin Supabase ni red).
List<Override> _store({
  _FakeApi? api,
  _FakeAuth? auth,
  Session? session,
  SocialProviders social = const SocialProviders(google: true, apple: true),
}) =>
    [
      sharedPrefsProvider.overrideWithValue(_prefs),
      apiClientProvider.overrideWithValue(api ?? _FakeApi()),
      authRepositoryProvider.overrideWithValue(auth ?? _FakeAuth()),
      sessionProvider.overrideWith((ref) => Stream.value(session)),
      authStateProvider.overrideWith((ref) => const Stream<AuthState>.empty()),
      socialProvidersProvider.overrideWith((ref) async => social),
    ];

/// Rutas de mentira para las pantallas que navegan con go_router.
GoRouter _routerFor(Widget screen) => GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => screen),
        for (final p in ['/catalogo', '/cuenta', '/ingresar', '/registro', '/admin', '/favoritos'])
          GoRoute(path: p, builder: (_, _) => Scaffold(body: Center(child: Text('RUTA $p')))),
        GoRoute(
          path: '/producto/:slug',
          builder: (_, s) => Scaffold(body: Center(child: Text('RUTA producto ${s.pathParameters['slug']}'))),
        ),
      ],
    );

void main() {
  setUpAll(setUpDeviceKit);

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    _prefs = await SharedPreferences.getInstance();
  });

  group('inicio', () {
    for (final phone in Phone.both) {
      testWidgets('se ve entero y se desplaza hasta el final en ${phone.name}', (tester) async {
        await pumpPhone(tester, const SizedBox(), phone: phone, home: _home(), overrides: _store(), router: _routerFor(const HomeScreen()));
        expect(find.text('Piezas impresas'), findsOneWidget);
        await shoot(tester, 'tienda_inicio');
        await scrollToEnd(tester);
        expect(find.text('Ofertas'), findsOneWidget, reason: 'la última sección se alcanza desplazando');
        await shoot(tester, 'tienda_inicio_fin');
      });
    }

    testWidgets('letra grande en el teléfono chico, en claro y en luz nocturna', (tester) async {
      for (final mode in [HefestoThemeMode.light, HefestoThemeMode.warm]) {
        await pumpPhone(tester, const SizedBox(), phone: Phone.small, theme: mode, textScale: 1.3, home: _home(), overrides: _store(), router: _routerFor(const HomeScreen()));
        await shoot(tester, 'tienda_inicio_grande_${mode.name}');
        await scrollToEnd(tester);
      }
    });

    testWidgets('sin banners, sin categorías y sin productos no se rompe', (tester) async {
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, home: HomeData.fromJson({}), overrides: _store(), router: _routerFor(const HomeScreen()));
      expect(find.text('HEFESTO '), findsNothing); // el título es un RichText
      expectNoLayoutErrors(tester);
    });
  });

  group('catálogo', () {
    for (final phone in Phone.both) {
      testWidgets('grilla y contador en ${phone.name}', (tester) async {
        await pumpPhone(tester, const SizedBox(), phone: phone, overrides: _store(), router: _routerFor(const CatalogScreen()));
        expect(find.text('8 productos'), findsOneWidget);
        await shoot(tester, 'tienda_catalogo');
        await scrollToEnd(tester, scrollable: find.descendant(of: find.byType(GridView), matching: find.byType(Scrollable)));
      });

      testWidgets('buscar algo que no existe, con el teclado abierto, no desborda en ${phone.name}', (tester) async {
        await pumpPhone(tester, const SizedBox(), phone: phone, overrides: _store(), router: _routerFor(const CatalogScreen()));
        await openKeyboard(tester, find.byType(TextField));
        await tester.enterText(find.byType(TextField), 'zzz no existe');
        await tester.testTextInput.receiveAction(TextInputAction.search);
        await closeKeyboard(tester); // "Buscar" cierra el teclado, como en el teléfono
        await settle(tester);
        expect(find.text('No encontramos productos'), findsOneWidget);
        // Vuelve a tocar el buscador para corregir: el teclado se abre SOBRE
        // el aviso de "sin resultados" (ahí era donde se desbordaba).
        await openKeyboard(tester, find.byType(TextField));
        expectNoLayoutErrors(tester, 'al mostrar "sin resultados" con el teclado abierto');
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'tienda_catalogo_sin_resultados_teclado');
      });

      testWidgets('hoja de filtros: se ve entera, con el tope de precio real, en ${phone.name}', (tester) async {
        final api = _FakeApi();
        await pumpPhone(tester, const SizedBox(), phone: phone, overrides: _store(api: api), router: _routerFor(const CatalogScreen()));
        await tester.tap(find.byIcon(Icons.tune_rounded));
        await settle(tester);
        expectNoLayoutErrors(tester);
        expect(find.text('Filtros'), findsOneWidget);
        // El tope sale del producto más caro ($110.000), no de un número fijo.
        expect(
          find.descendant(of: find.byType(BottomSheet), matching: find.text('\$110.000')),
          findsOneWidget,
        );
        expectReachable(tester, find.byKey(const Key('apply_filters')), what: 'el botón "Aplicar filtros"');
        expect(tester.getRect(find.text('Filtros')).top >= currentPhone.top, isTrue, reason: 'la hoja no puede meterse debajo de la barra de estado');
        await shoot(tester, 'tienda_filtros');

        await tester.tap(find.text('PETG'));
        await tester.tap(find.text('Solo ofertas'));
        await settle(tester, 2);
        await tester.tap(find.byKey(const Key('apply_filters')));
        await settle(tester);
        expect(find.text('Filtros'), findsNothing, reason: 'aplicar cierra la hoja');
        expect(api.searches.last.material, 'PETG');
        expect(api.searches.last.onSale, isTrue);
        expect(api.searches.last.maxPrice, isNull, reason: 'el precio sin tocar no filtra');
      });
    }

    testWidgets('hoja de filtros con letra grande en el teléfono chico', (tester) async {
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, theme: HefestoThemeMode.light, overrides: _store(), router: _routerFor(const CatalogScreen()));
      await tester.tap(find.byIcon(Icons.tune_rounded));
      await settle(tester);
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.byKey(const Key('apply_filters')), what: 'el botón "Aplicar filtros"');
      await shoot(tester, 'tienda_filtros_grande_claro');
    });
  });

  group('producto', () {
    for (final phone in Phone.both) {
      testWidgets('opciones largas (23 colores, tamaños de 45 letras) en ${phone.name}', (tester) async {
        await pumpPhone(tester, const SizedBox(), phone: phone, home: _home(), overrides: _store(), router: _routerFor(const ProductScreen(slug: 'kit-reglas')));
        expectNoLayoutErrors(tester);
        // Dice con precisión qué falta elegir.
        expect(find.text('Elegí tamaño y color'), findsOneWidget);
        expectReachable(tester, find.byType(GoldButton), what: 'el botón de consultar');
        await shoot(tester, 'tienda_producto');

        await _tapInView(tester, find.text('3 x 4 pulgadas (aproximadamente 7,6 x 10,1 cm)'));
        expect(find.text('Elegí un color'), findsOneWidget);
        expect(find.text('\$2.500'), findsWidgets, reason: 'el precio sigue al tamaño elegido');
        expectNoLayoutErrors(tester, 'con un tamaño de nombre largo elegido');

        await _tapInView(tester, find.text('Verde agua'));
        expect(find.text('Consultar por WhatsApp'), findsOneWidget);
        expectNoLayoutErrors(tester);
        await scrollToEnd(tester);
        await shoot(tester, 'tienda_producto_fin');
      });
    }

    testWidgets('letra grande en el teléfono chico', (tester) async {
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, theme: HefestoThemeMode.warm, home: _home(), overrides: _store(), router: _routerFor(const ProductScreen(slug: 'kit-reglas')));
      expectNoLayoutErrors(tester);
      expectReachable(tester, find.byType(GoldButton), what: 'el botón de consultar');
      await scrollToEnd(tester);
      await shoot(tester, 'tienda_producto_grande_calido');
    });
  });

  group('favoritos', () {
    testWidgets('vacío y con productos, en el teléfono chico', (tester) async {
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, overrides: _store(), router: _routerFor(const FavoritesScreen()));
      expect(find.text('Todavía no tenés favoritos'), findsOneWidget);
      await shoot(tester, 'tienda_favoritos_vacio');

      SharedPreferences.setMockInitialValues({
        'favorites_v1': '[${_catalog.take(3).map((p) => _encode(Product.fromJson(p))).join(',')}]',
      });
      _prefs = await SharedPreferences.getInstance();
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, overrides: _store(), router: _routerFor(const FavoritesScreen()));
      expect(find.byType(ProductCard), findsNWidgets(3));
      await shoot(tester, 'tienda_favoritos');
    });
  });

  group('cuenta', () {
    testWidgets('visitante: ofrece ingresar y la política de privacidad, no la baja', (tester) async {
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, home: _home(), overrides: _store(), router: _routerFor(const AccountScreen()));
      expect(find.text('Ingresar'), findsOneWidget);
      await scrollToEnd(tester);
      expect(find.text('Política de privacidad'), findsOneWidget);
      expect(find.byKey(const Key('delete_account')), findsNothing);
      expect(find.text('Hefesto 3D · v${AppConfig.appVersion}'), findsOneWidget);
      await shoot(tester, 'tienda_cuenta_visitante');
    });

    for (final phone in Phone.both) {
      testWidgets('cliente: eliminar la cuenta pide confirmación, borra y cierra sesión (${phone.name})', (tester) async {
        final api = _FakeApi();
        final auth = _FakeAuth();
        await pumpPhone(tester, const SizedBox(), phone: phone, home: _home(), me: _customer, overrides: _store(api: api, auth: auth, session: _session), router: _routerFor(const AccountScreen()));
        expect(find.text('Juana Cliente'), findsOneWidget);
        await scrollToEnd(tester);
        expectReachable(tester, find.byKey(const Key('delete_account')), what: '"Eliminar mi cuenta"');
        await tester.tap(find.byKey(const Key('delete_account')));
        await settle(tester);
        expect(find.text('¿Eliminar tu cuenta?'), findsOneWidget);
        expect(api.deleteCalls, 0, reason: 'todavía no se borró nada');
        expectReachable(tester, find.byKey(const Key('confirm_delete_account')), what: 'el botón de confirmar');
        expectReachable(tester, find.widgetWithText(TextButton, 'Cancelar'), what: 'el botón de cancelar');
        await shoot(tester, 'tienda_cuenta_eliminar');

        await tester.tap(find.byKey(const Key('confirm_delete_account')));
        await settle(tester);
        expect(api.deleteCalls, 1);
        expect(auth.signOuts, 1, reason: 'se cierra la sesión del teléfono');
        expect(find.text('¿Eliminar tu cuenta?'), findsNothing);
        expect(find.text('Tu cuenta fue eliminada.'), findsOneWidget);
      });
    }

    testWidgets('cancelar no borra nada', (tester) async {
      final api = _FakeApi();
      final auth = _FakeAuth();
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, home: _home(), me: _customer, overrides: _store(api: api, auth: auth, session: _session), router: _routerFor(const AccountScreen()));
      await scrollToEnd(tester);
      await tester.tap(find.byKey(const Key('delete_account')));
      await settle(tester);
      await tester.tap(find.widgetWithText(TextButton, 'Cancelar'));
      await settle(tester);
      expect(api.deleteCalls, 0);
      expect(auth.signOuts, 0);
    });

    testWidgets('si el servidor no puede borrar, muestra el motivo y la cuenta sigue abierta', (tester) async {
      final api = _FakeApi(deleteError: ApiException('unavailable', 'No pudimos eliminar la cuenta. Probá de nuevo en unos minutos.'));
      final auth = _FakeAuth();
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, home: _home(), me: _customer, overrides: _store(api: api, auth: auth, session: _session), router: _routerFor(const AccountScreen()));
      await scrollToEnd(tester);
      await tester.tap(find.byKey(const Key('delete_account')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('confirm_delete_account')));
      await settle(tester);
      expectNoLayoutErrors(tester);
      expect(find.textContaining('No pudimos eliminar la cuenta'), findsOneWidget);
      expect(auth.signOuts, 0);
      expectReachable(tester, find.byKey(const Key('confirm_delete_account')), what: 'el botón para reintentar');
      await shoot(tester, 'tienda_cuenta_eliminar_error_grande');
    });

    testWidgets('equipo: ve el panel y la baja le explica que la hace un administrador', (tester) async {
      final api = _FakeApi();
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, home: _home(), me: staffWith(['pedidos']), overrides: _store(api: api, session: _session), router: _routerFor(const AccountScreen()));
      expect(find.text('Panel de administración'), findsOneWidget);
      expect(find.text('Administrador'), findsOneWidget);
      await scrollToEnd(tester);
      await tester.tap(find.byKey(const Key('delete_account')));
      await settle(tester);
      expect(find.text('Cuenta del equipo'), findsOneWidget);
      expect(find.byKey(const Key('confirm_delete_account')), findsNothing);
      await tester.tap(find.text('Entendido'));
      await settle(tester);
      expect(api.deleteCalls, 0);
    });

    testWidgets('los tres modos de color se ven bien', (tester) async {
      for (final mode in HefestoThemeMode.values) {
        await pumpPhone(tester, const SizedBox(), phone: Phone.iphone, theme: mode, home: _home(), me: _customer, overrides: _store(session: _session), router: _routerFor(const AccountScreen()));
        await shoot(tester, 'tienda_cuenta_${mode.name}');
      }
    });
  });

  group('ingreso', () {
    for (final phone in Phone.both) {
      testWidgets('ingresar con el teclado abierto en ${phone.name}', (tester) async {
        final auth = _FakeAuth();
        await pumpPhone(tester, const SizedBox(), phone: phone, overrides: _store(auth: auth), router: _routerFor(const LoginScreen()));
        await shoot(tester, 'tienda_ingresar');
        final fields = find.byType(TextFormField);
        await openKeyboard(tester, fields.at(0));
        expectFocusedFieldVisible(tester);
        await tester.enterText(fields.at(0), 'ale@example.com');
        await tester.tap(fields.at(1), warnIfMissed: false);
        await settle(tester, 4);
        expectFocusedFieldVisible(tester);
        await tester.enterText(fields.at(1), 'Clave1234');
        await shoot(tester, 'tienda_ingresar_teclado');
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await settle(tester);
        expect(auth.signIns, ['ale@example.com']);
        expect(find.text('RUTA /cuenta'), findsOneWidget);
      });

      testWidgets('crear cuenta: el último campo queda a la vista con el teclado en ${phone.name}', (tester) async {
        await pumpPhone(tester, const SizedBox(), phone: phone, overrides: _store(), router: _routerFor(const RegisterScreen()));
        final fields = find.byType(TextFormField);
        expect(fields, findsNWidgets(4));
        await openKeyboard(tester, fields.at(3));
        expectFocusedFieldVisible(tester);
        await shoot(tester, 'tienda_registro_teclado');
        await closeKeyboard(tester);
        await scrollToEnd(tester);
        expect(find.text('Al crear tu cuenta aceptás la Política de privacidad'), findsOneWidget);
      });
    }

    testWidgets('crear cuenta con letra grande en el teléfono chico (los tres modos)', (tester) async {
      for (final mode in HefestoThemeMode.values) {
        await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, theme: mode, overrides: _store(), router: _routerFor(const RegisterScreen()));
        await shoot(tester, 'tienda_registro_grande_${mode.name}');
        await scrollToEnd(tester);
      }
    });

    testWidgets('contraseña nueva: valida, guarda y avisa', (tester) async {
      final auth = _FakeAuth();
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, overrides: _store(auth: auth), router: _routerFor(const NewPasswordScreen()));
      await openKeyboard(tester, find.byKey(const Key('new_password')));
      expectFocusedFieldVisible(tester);
      await tester.enterText(find.byKey(const Key('new_password')), 'corta');
      await tester.enterText(find.byKey(const Key('new_password_confirm')), 'corta');
      await closeKeyboard(tester);
      await tester.tap(find.text('Guardar contraseña'));
      await settle(tester, 3);
      expect(auth.newPassword, isNull, reason: 'una contraseña débil no se manda');
      expect(find.text('Mínimo 8 caracteres, con mayúscula, minúscula y número'), findsOneWidget);
      await shoot(tester, 'tienda_nueva_clave_error');

      await tester.enterText(find.byKey(const Key('new_password')), 'ClaveNueva2026');
      await tester.enterText(find.byKey(const Key('new_password_confirm')), 'ClaveNueva2026');
      await tester.tap(find.text('Guardar contraseña'));
      await settle(tester);
      expect(auth.newPassword, 'ClaveNueva2026');
      expect(find.text('RUTA /cuenta'), findsOneWidget);
    });
  });

  group('ingreso social: solo lo que el servidor tiene habilitado', () {
    Future<void> login(WidgetTester tester, SocialProviders social) => pumpPhone(
          tester,
          const SizedBox(),
          phone: Phone.small,
          overrides: _store(social: social),
          router: _routerFor(const LoginScreen()),
        );

    testWidgets('Android con Google habilitado: solo Google', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      await login(tester, const SocialProviders(google: true));
      expect(find.bySemanticsLabel('Continuar con Google'), findsOneWidget);
      expect(find.bySemanticsLabel('Continuar con Apple'), findsNothing);
      expect(find.text('o continuá con'), findsOneWidget);
      debugDefaultTargetPlatformOverride = null;
    });

    testWidgets('iPhone con los dos habilitados: Google y Apple', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      await login(tester, const SocialProviders(google: true, apple: true));
      expect(find.bySemanticsLabel('Continuar con Google'), findsOneWidget);
      expect(find.bySemanticsLabel('Continuar con Apple'), findsOneWidget);
      await shoot(tester, 'tienda_ingresar_ios');
      debugDefaultTargetPlatformOverride = null;
    });

    testWidgets('iPhone SIN Apple habilitado: tampoco se ofrece Google (regla 4.8 de la App Store)', (tester) async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      await login(tester, const SocialProviders(google: true));
      expect(find.bySemanticsLabel('Continuar con Google'), findsNothing);
      expect(find.bySemanticsLabel('Continuar con Apple'), findsNothing);
      expect(find.text('o continuá con'), findsNothing, reason: 'sin botones no va el separador');
      debugDefaultTargetPlatformOverride = null;
    });

    testWidgets('sin datos del servidor: solo email y contraseña', (tester) async {
      await login(tester, SocialProviders.none);
      expect(find.bySemanticsLabel('Continuar con Google'), findsNothing);
      expect(find.text('o continuá con'), findsNothing);
      expect(find.text('Ingresar'), findsOneWidget);
    });

    test('lee la respuesta de configuración de Supabase', () {
      final s = SocialProviders.fromSettings({
        'external': {'google': true, 'apple': false, 'email': true},
      });
      expect(s.google, isTrue);
      expect(s.apple, isFalse);
      expect(SocialProviders.fromSettings(null).google, isFalse);
      expect(SocialProviders.fromSettings({'external': 'raro'}).google, isFalse);
    }, skip: false);
  });

  group('navegación de la app completa', () {
    testWidgets('el mismo producto en inicio, catálogo y relacionados: abrirlo no falla (animación de la foto)', (tester) async {
      final router = ProviderContainer().read(routerProvider);
      await pumpPhone(tester, const SizedBox(), phone: Phone.android, home: _home(), overrides: _store(), router: router);
      // "chopper" está en Más vendidos y en Nuevos lanzamientos a la vez.
      expect(find.text('Tony Tony Chopper | Tamaño Real'), findsWidgets);

      // Catálogo (segunda pestaña): ahí también está.
      await tester.tap(find.text('Catálogo'));
      await settle(tester);
      expect(find.text('8 productos'), findsOneWidget);
      await tester.tap(find.text('Tony Tony Chopper | Tamaño Real').last);
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'al abrir un producto que también está en el inicio');
      expect(find.text('Descripción'), findsOneWidget);

      // Desde el detalle, un relacionado (que además está en el inicio).
      await scrollToEnd(tester);
      await tester.tap(find.text('Mini Jesús – Sentado en el monitor o estante').last);
      await settle(tester, 8);
      expectNoLayoutErrors(tester, 'al abrir un producto relacionado');

      // Atrás dos veces vuelve al catálogo.
      router.pop();
      await settle(tester, 8);
      router.pop();
      await settle(tester, 8);
      expect(find.text('8 productos'), findsOneWidget);
      expectNoLayoutErrors(tester);
    });

    testWidgets('las cuatro pestañas con letra grande en el teléfono chico', (tester) async {
      final router = ProviderContainer().read(routerProvider);
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, textScale: 1.3, home: _home(), overrides: _store(), router: router);
      for (final tab in ['Catálogo', 'Favoritos', 'Cuenta', 'Inicio']) {
        await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(tab)));
        await settle(tester);
        expectNoLayoutErrors(tester, 'en la pestaña $tab');
        await shoot(tester, 'tienda_tab_${tab.toLowerCase()}_grande');
      }
    });

    testWidgets('una dirección que no existe muestra un aviso con salida al inicio', (tester) async {
      final router = ProviderContainer().read(routerProvider);
      await pumpPhone(tester, const SizedBox(), phone: Phone.small, home: _home(), overrides: _store(), router: router);
      router.go('/esto-no-existe');
      await settle(tester);
      expect(find.text('No encontramos esa pantalla'), findsOneWidget);
      await tester.tap(find.text('Ir al inicio'));
      await settle(tester);
      expect(find.text('Piezas impresas'), findsOneWidget);
    });
  });

  test('la versión que muestra la app coincide con pubspec.yaml', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final version = RegExp(r'^version:\s*([0-9.]+)\+', multiLine: true).firstMatch(pubspec)!.group(1);
    expect(AppConfig.appVersion, version);
  });
}

/// Lleva [finder] al medio de la pantalla (lejos de la barra fija de abajo) y
/// lo toca, como hace una persona al desplazar.
Future<void> _tapInView(WidgetTester tester, Finder finder) async {
  await Scrollable.ensureVisible(tester.element(finder), alignment: 0.4);
  await settle(tester, 3);
  await tester.tap(finder);
  await settle(tester, 3);
}

String _encode(Product p) {
  final j = p.toJson();
  String v(Object? x) => x == null
      ? 'null'
      : x is String
          ? '"${x.replaceAll('"', r'\"')}"'
          : x is Map
              ? '{${x.entries.map((e) => '"${e.key}":${v(e.value)}').join(',')}}'
              : '$x';
  return v(j);
}
