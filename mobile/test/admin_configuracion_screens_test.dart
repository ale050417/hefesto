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
import 'package:hefesto/features/admin/configuracion/banner_edit_screen.dart';
import 'package:hefesto/features/admin/configuracion/config_api.dart';
import 'package:hefesto/features/admin/configuracion/config_models.dart';
import 'package:hefesto/features/admin/configuracion/configuracion_screen.dart';
import 'package:hefesto/features/admin/configuracion/envios_screen.dart';
import 'package:hefesto/features/admin/configuracion/equipo_screen.dart';
import 'package:hefesto/features/admin/configuracion/invite_screen.dart';
import 'package:hefesto/features/admin/configuracion/negocio_screen.dart';
import 'package:hefesto/features/admin/configuracion/pagos_screen.dart';
import 'package:hefesto/features/admin/configuracion/role_edit_screen.dart';
import 'package:hefesto/features/admin/configuracion/textos_editors.dart';
import 'package:hefesto/features/admin/configuracion/textos_screen.dart';
import 'package:hefesto/features/admin/configuracion/tienda_screen.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'admin_configuracion_fixtures.dart';

/// Dibuja cada pantalla de Configuración con datos de ejemplo (humo + capturas
/// con SHOT_DIR=ruta_de_una_carpeta) y prueba lo importante: guardado por
/// sección, aviso de cambios sin guardar, validaciones y permisos.
final _shotDir = Platform.environment['SHOT_DIR'];

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final f in files) {
    loader.addFont(File(f).readAsBytes().then((b) => ByteData.sublistView(b)));
  }
  await loader.load();
}

MeInfo _me({bool admin = true, bool edit = true, bool view = true, bool productos = false, bool pedidos = false}) =>
    MeInfo.fromJson({
      'id': 'u1',
      'email': 'ale@hefesto.com',
      'fullName': 'Ale',
      'role': admin ? 'admin' : 'operator',
      'isStaff': true,
      'permissions': {
        'config': {'ver': view, 'crear': false, 'editar': edit, 'eliminar': false},
        'productos': {'ver': true, 'editar': productos},
        'pedidos': {'ver': true, 'editar': pedidos},
      },
    });

/// Doble del cliente de Configuración: anota las llamadas y puede fallar.
class FakeConfigApi extends ConfigApi {
  FakeConfigApi({this.failWith}) : super(ApiClient());
  String? failWith;
  final calls = <(String, Object?)>[];

  Future<T> _rec<T>(String name, Object? args, T value) async {
    calls.add((name, args));
    if (failWith != null) throw ApiException('invalid', failWith!);
    return value;
  }

  @override
  Future<void> saveNegocio(Map<String, dynamic> body) => _rec('negocio', body, null);
  @override
  Future<void> saveEnvios(Map<String, dynamic> body) => _rec('envios', body, null);
  @override
  Future<void> savePagos(Map<String, dynamic> body) => _rec('pagos', body, null);
  @override
  Future<void> connectMercadoPago(String token) => _rec('mp_connect', token, null);
  @override
  Future<void> disconnectMercadoPago() => _rec('mp_disconnect', null, null);
  @override
  Future<void> saveTienda(Map<String, dynamic> body) => _rec('tienda', body, null);
  @override
  Future<void> saveTextos(Map<String, dynamic> body) => _rec('textos', body, null);
  @override
  Future<void> saveCotizacion(Map<String, dynamic> body) => _rec('cotizacion', body, null);
  @override
  Future<void> updateBanner(String id, Map<String, dynamic> body) => _rec('banner:$id', body, null);
  @override
  Future<void> deleteBanner(String id) => _rec('banner_delete', id, null);
  @override
  Future<Map<String, dynamic>> invite({
    required String email,
    required String roleId,
    String fullName = '',
    String message = '',
  }) =>
      _rec('invite', {'email': email, 'roleId': roleId, 'fullName': fullName, 'message': message},
          <String, dynamic>{'ok': true, 'promoted': false});
  @override
  Future<Map<String, dynamic>> resendInvite(String userId) =>
      _rec('resend', userId, <String, dynamic>{'ok': true, 'email': 'anto@x.com'});
  @override
  Future<void> assignRole(String userId, String roleId) => _rec('assign', (userId, roleId), null);
  @override
  Future<void> removeMember(String userId) => _rec('remove', userId, null);
  @override
  Future<void> createRole(String name, Map<String, List<String>> permissions) =>
      _rec('role_create', {'name': name, 'permissions': permissions}, null);
  @override
  Future<void> updateRole(String id, String name, Map<String, List<String>> permissions) =>
      _rec('role_update', {'id': id, 'name': name, 'permissions': permissions}, null);
  @override
  Future<void> deleteRole(String id) => _rec('role_delete', id, null);
}

final _config = AdminConfig.fromJson(configJson());
final _team = TeamData.fromJson(teamJson());

Future<void> _show(
  WidgetTester tester,
  String name,
  Widget screen, {
  double height = 880,
  double width = 392,
  MeInfo? me,
  FakeConfigApi? api,
  List<Override> overrides = const [],
  Override? configOverride,
  Override? teamOverride,
  double textScale = 1,
  HefestoThemeMode theme = HefestoThemeMode.dark,
}) async {
  tester.view.devicePixelRatio = 2.75;
  tester.view.physicalSize = Size(width * 2.75, height * 2.75);
  addTearDown(tester.view.reset);

  final key = GlobalKey();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        homeProvider.overrideWith((ref) async => HomeData.fromJson({})),
        meProvider.overrideWith((ref) async => me ?? _me()),
        configOverride ?? adminConfigProvider.overrideWith((ref) async => _config),
        teamOverride ?? adminTeamProvider.overrideWith((ref) async => _team),
        configApiProvider.overrideWithValue(api ?? FakeConfigApi()),
        ...overrides,
      ],
      child: RepaintBoundary(
        key: key,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: AppTheme.of(theme),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: screen,
        ),
      ),
    ),
  );
  await _settle(tester);
  final thrown = tester.takeException();
  expect(thrown, isNull, reason: 'la pantalla $name lanzó una excepción (¿overflow?)');

  if (_shotDir != null) {
    await tester.runAsync(() async {
      final boundary = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1.2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File('$_shotDir/$name.png').writeAsBytes(bytes!.buffer.asUint8List());
    });
  }
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 8; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Finder _saveButton() => find.text('Guardar cambios');

/// ¿El botón de guardar está habilitado? (GoldButton usa Opacity + InkWell).
bool _saveEnabled(WidgetTester tester, [String label = 'Guardar cambios']) {
  final inkWell = find.ancestor(of: find.text(label), matching: find.byType(InkWell));
  return tester.widget<InkWell>(inkWell.first).onTap != null;
}

Future<void> _type(WidgetTester tester, String label, String text) async {
  // El campo está justo debajo de su etiqueta.
  final field = find.descendant(
    of: find.ancestor(of: find.text(label), matching: find.byType(Column)).first,
    matching: find.byType(TextFormField),
  );
  await tester.ensureVisible(field.first);
  await tester.enterText(field.first, text);
  await tester.pump();
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('es_AR');
    // Tipografías de la marca e íconos de Material: con las de verdad, los
    // anchos son los reales (con la fuente de prueba, que es cuadrada, un
    // texto grande se "desborda" aunque en el celular entre de sobra).
    if (_shotDir != null) Directory(_shotDir!).createSync(recursive: true);
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
  });

  group('Menú de Configuración', () {
    testWidgets('muestra las secciones con su resumen', (tester) async {
      await _show(tester, 'config_menu', const AdminConfiguracionScreen(), height: 1100);
      expect(find.text('Datos del negocio'), findsOneWidget);
      expect(find.text('Tienda y apariencia'), findsOneWidget);
      expect(find.text('Envío y retiro'), findsOneWidget);
      expect(find.text('Medios de pago'), findsOneWidget);
      expect(find.text('Textos clave'), findsOneWidget);
      expect(find.text('Equipo y roles'), findsOneWidget);
      expect(find.textContaining('Hefesto 3D · +54 3757 624148'), findsOneWidget);
      expect(find.textContaining('Navidad'), findsWidgets);
      expect(find.textContaining('Retiro sí · Envío no · 2 barrios'), findsOneWidget);
      expect(find.text('Transferencia · MercadoPago'), findsOneWidget);
      // MercadoPago activo pero sin token: aviso.
      expect(find.text('MercadoPago sin conectar'), findsOneWidget);
    });

    testWidgets('un rol que solo puede ver lo avisa', (tester) async {
      await _show(tester, 'config_menu_solo_ver', const AdminConfiguracionScreen(),
          height: 1100, me: _me(admin: false, edit: false));
      expect(find.text('Tu rol puede ver la configuración, pero no cambiarla.'), findsOneWidget);
    });

    testWidgets('sin permiso de configuración: "Sin acceso"', (tester) async {
      await _show(tester, 'config_sin_acceso', const AdminConfiguracionScreen(),
          me: _me(admin: false, view: false, edit: false));
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(find.text('Datos del negocio'), findsNothing);
    });

    testWidgets('si el servidor falla: error con Reintentar', (tester) async {
      await _show(
        tester,
        'config_error',
        const AdminConfiguracionScreen(),
        configOverride: adminConfigProvider.overrideWith((ref) => throw ApiException('unavailable', 'No pudimos cargar. Probá de nuevo.')),
      );
      expect(find.text('Reintentar'), findsOneWidget);
      expect(find.textContaining('No pudimos cargar'), findsOneWidget);
    });

    testWidgets('tocar una sección abre su pantalla', (tester) async {
      await _show(tester, 'config_menu2', const AdminConfiguracionScreen(), height: 1100);
      await tester.tap(find.text('Datos del negocio'));
      await _settle(tester);
      expect(find.text('Nombre comercial'), findsOneWidget);
      expect(find.text('Guardar cambios'), findsOneWidget);
    });
  });

  group('Datos del negocio', () {
    testWidgets('se ve completo, con los horarios', (tester) async {
      await _show(tester, 'config_negocio', NegocioScreen(initial: _config.negocio, canEdit: true), height: 2300);
      expect(find.text('Hefesto 3D'), findsWidgets);
      expect(find.text('Horario de atención'.toUpperCase()), findsOneWidget);
      expect(find.text('Cerrado'), findsWidgets);
      expect(find.text('09:00'), findsWidgets);
    });

    testWidgets('"Guardar" arranca deshabilitado y se habilita al cambiar algo', (tester) async {
      await _show(tester, 'config_negocio_edit', NegocioScreen(initial: _config.negocio, canEdit: true), height: 1400);
      expect(_saveEnabled(tester), isFalse);
      await _type(tester, 'Eslogan', 'Nuevo eslogan');
      expect(_saveEnabled(tester), isTrue);
      // Volver a lo guardado lo deshabilita otra vez.
      await _type(tester, 'Eslogan', 'Forjado en capas');
      expect(_saveEnabled(tester), isFalse);
    });

    testWidgets('guarda por sección y avisa', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_negocio_save', NegocioScreen(initial: _config.negocio, canEdit: true),
          height: 1400, api: api);
      await _type(tester, 'Eslogan', '  Nuevo eslogan ');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(api.calls, hasLength(1));
      expect(api.calls.single.$1, 'negocio');
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(body['slogan'], 'Nuevo eslogan');
      expect(body['storeName'], 'Hefesto 3D');
      expect(body['tiktok'], '@hefesto.tiktok');
      expect((body['hours'] as List), hasLength(3));
      expect(find.text('Datos del negocio guardados'), findsOneWidget);
      expect(_saveEnabled(tester), isFalse, reason: 'quedó "limpio" tras guardar');
    });

    testWidgets('valida nombre y email antes de llamar al servidor', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_negocio_validacion', NegocioScreen(initial: _config.negocio, canEdit: true),
          height: 1400, api: api);
      await _type(tester, 'Nombre comercial', '   ');
      await _type(tester, 'Email de contacto', 'esto-no-es-un-mail');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(api.calls, isEmpty);
      expect(find.text('Ingresá el nombre del negocio.'), findsOneWidget);
      expect(find.text('El email no es válido.'), findsOneWidget);
      expect(find.text('Revisá los campos marcados.'), findsOneWidget);
    });

    testWidgets('el error del servidor se muestra en castellano y no pierde lo escrito', (tester) async {
      final api = FakeConfigApi(failWith: 'No tenés permiso para hacer esto.');
      await _show(tester, 'config_negocio_error', NegocioScreen(initial: _config.negocio, canEdit: true),
          height: 1400, api: api);
      await _type(tester, 'Eslogan', 'Otro');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(find.text('No tenés permiso para hacer esto.'), findsOneWidget);
      expect(_saveEnabled(tester), isTrue, reason: 'sigue habilitado para reintentar');
    });

    testWidgets('salir con cambios sin guardar pregunta; "Seguir editando" se queda', (tester) async {
      await _show(tester, 'config_negocio_salir',
          Builder(builder: (context) => Scaffold(body: Center(child: ElevatedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => NegocioScreen(initial: _config.negocio, canEdit: true))),
            child: const Text('abrir'),
          )))),
          height: 1400);
      await tester.tap(find.text('abrir'));
      await _settle(tester);

      // Sin cambios: sale directo.
      await tester.pageBack();
      await _settle(tester);
      expect(find.text('Cambios sin guardar'), findsNothing);
      expect(find.text('abrir'), findsOneWidget);

      // Con cambios: avisa.
      await tester.tap(find.text('abrir'));
      await _settle(tester);
      await _type(tester, 'Eslogan', 'Cambiado');
      await tester.pageBack();
      await _settle(tester);
      expect(find.text('Cambios sin guardar'), findsOneWidget);

      await tester.tap(find.text('Seguir editando'));
      await _settle(tester);
      expect(find.text('Cambios sin guardar'), findsNothing);
      expect(find.text('Nombre comercial'), findsOneWidget);

      await tester.pageBack();
      await _settle(tester);
      await tester.tap(find.text('Salir sin guardar'));
      await _settle(tester);
      expect(find.text('abrir'), findsOneWidget, reason: 'volvió al menú');
    });

    testWidgets('sin permiso de editar: campos bloqueados y sin botón', (tester) async {
      await _show(tester, 'config_negocio_solo_ver', NegocioScreen(initial: _config.negocio, canEdit: false),
          height: 1400);
      expect(find.text('Tu rol puede ver esta sección, pero no cambiarla.'), findsOneWidget);
      expect(find.text('Guardar cambios'), findsNothing);
    });

    testWidgets('a 360 y letra grande no se desborda', (tester) async {
      await _show(tester, 'config_negocio_360', NegocioScreen(initial: _config.negocio, canEdit: true),
          height: 2600, width: 360, textScale: 1.6);
    });
  });

  group('Envío y retiro', () {
    testWidgets('se ve y calcula el resumen', (tester) async {
      await _show(tester, 'config_envios', EnviosScreen(initial: _config.envios, canEdit: true), height: 1500);
      expect(find.text('Retiro en local'), findsOneWidget);
      expect(find.text('Envío a domicilio'), findsOneWidget);
      expect(find.text('Centro'), findsOneWidget);
      expect(find.text('2000.5'), findsOneWidget);
    });

    testWidgets('agregar y quitar barrios, y guardar', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_envios_zonas', EnviosScreen(initial: _config.envios, canEdit: true),
          height: 1700, api: api);
      expect(_saveEnabled(tester), isFalse);

      await tester.tap(find.text('+ Agregar'));
      await tester.pump();
      // Una fila vacía todavía no cuenta como cambio.
      expect(_saveEnabled(tester), isFalse);
      await tester.enterText(find.widgetWithText(TextFormField, 'Barrio 3'), 'Villa Cabot');
      await tester.pump();
      expect(_saveEnabled(tester), isTrue);

      await tester.tap(find.byTooltip('Quitar barrio').first); // saca "Centro"
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);

      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'envios');
      expect(body['zones'], [
        {'name': 'Km 5', 'price': 2000.5},
        {'name': 'Villa Cabot', 'price': 0},
      ]);
      expect(body['city'], 'Iguazú');
      expect(body['pickupEnabled'], true);
      expect(body['deliveryEnabled'], false);
    });

    testWidgets('los interruptores de retiro y envío cuentan como cambio', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_envios_switch', EnviosScreen(initial: _config.envios, canEdit: true),
          height: 1500, api: api);
      await tester.tap(find.byType(Switch).last); // envío a domicilio: estaba apagado
      await tester.pump();
      expect(_saveEnabled(tester), isTrue);
      await tester.tap(_saveButton());
      await _settle(tester);
      expect((api.calls.single.$2! as Map)['deliveryEnabled'], true);
    });

    testWidgets('un monto inválido no se manda', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_envios_monto', EnviosScreen(initial: _config.envios, canEdit: true),
          height: 1500, api: api);
      await _type(tester, 'Envío gratis desde (ARS)', '1.2.3');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(api.calls, isEmpty);
      expect(find.text('Ingresá un monto válido.'), findsOneWidget);
    });
  });

  group('Medios de pago', () {
    testWidgets('se ve con el estado de MercadoPago', (tester) async {
      await _show(tester, 'config_pagos', PagosScreen(initial: _config.pagos, canEdit: true), height: 1400);
      expect(find.text('Transferencia bancaria'), findsOneWidget);
      expect(find.text('Sin conectar'), findsOneWidget);
      expect(find.text('Conectar'), findsOneWidget);
      expect(find.text('hefesto.3d'), findsWidgets);
    });

    testWidgets('guarda solo los medios (el token va aparte)', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_pagos_save', PagosScreen(initial: _config.pagos, canEdit: true),
          height: 1400, api: api);
      await _type(tester, 'Alias', 'nuevo.alias');
      await tester.tap(_saveButton());
      await _settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'pagos');
      expect(body['transferAlias'], 'nuevo.alias');
      expect(body.keys, isNot(contains('token')));
      expect(body.keys, isNot(contains('mpAccessToken')));
    });

    testWidgets('conectar MercadoPago pide el token oculto y lo manda', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_pagos_mp', PagosScreen(initial: _config.pagos, canEdit: true),
          height: 1400, api: api);
      await tester.tap(find.text('Conectar'));
      await _settle(tester);
      expect(find.text('Access Token de MercadoPago'), findsOneWidget);
      final field = tester.widget<TextField>(find.byType(TextField).last);
      expect(field.obscureText, isTrue, reason: 'el token se escribe oculto');
      expect(field.autocorrect, isFalse);

      // Muy corto: lo rechaza sin llamar.
      await tester.enterText(find.byType(TextField).last, 'abc');
      await tester.tap(find.text('Conectar').last);
      await _settle(tester);
      expect(find.text('Pegá tu Access Token completo.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await tester.enterText(find.byType(TextField).last, 'APP_USR-1234567890');
      await tester.tap(find.text('Conectar').last);
      await _settle(tester);
      expect(api.calls.single, ('mp_connect', 'APP_USR-1234567890'));
      expect(find.text('Conectado'), findsOneWidget);
      expect(find.text('Desconectar'), findsOneWidget);
      // El token no queda en pantalla.
      expect(find.textContaining('APP_USR'), findsNothing);
    });

    testWidgets('desconectar pide confirmación', (tester) async {
      final api = FakeConfigApi();
      final connected = PagosConfig.fromJson({...((configJson()['pagos']) as Map<String, dynamic>), 'mpConnected': true});
      await _show(tester, 'config_pagos_desconectar', PagosScreen(initial: connected, canEdit: true),
          height: 1400, api: api);
      await tester.tap(find.text('Desconectar'));
      await _settle(tester);
      expect(find.text('Desconectar MercadoPago'), findsOneWidget);
      await tester.tap(find.text('Desconectar').last);
      await _settle(tester);
      expect(api.calls.single.$1, 'mp_disconnect');
      expect(find.text('Sin conectar'), findsOneWidget);
    });

    testWidgets('solo lectura: sin botones de conexión', (tester) async {
      await _show(tester, 'config_pagos_solo_ver', PagosScreen(initial: _config.pagos, canEdit: false), height: 1400);
      expect(find.text('Conectar'), findsNothing);
      expect(find.text('Guardar cambios'), findsNothing);
    });
  });

  group('Tienda y apariencia', () {
    testWidgets('se ve: modo, color, temporadas, secciones y banners', (tester) async {
      await _show(tester, 'config_tienda', TiendaScreen(initial: _config.tienda, canEdit: true), height: 3000);
      expect(find.text('Vidriera digital'), findsOneWidget);
      expect(find.text('Navidad'), findsOneWidget);
      expect(find.text('Decoración animada'), findsOneWidget, reason: 'Navidad tiene decoración');
      expect(find.text('Banda de confianza'), findsOneWidget);
      expect(find.text('Figuras de colección'), findsOneWidget);
      expect(find.text('Visible'), findsOneWidget);
      expect(find.text('Oculto'), findsOneWidget);
      expect(find.textContaining('se cambian desde la web'), findsOneWidget);
    });

    testWidgets('guarda por sección con todo lo de la pantalla', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_tienda_save', TiendaScreen(initial: _config.tienda, canEdit: true),
          height: 3000, api: api);
      expect(_saveEnabled(tester), isFalse);
      await tester.tap(find.text('Halloween'));
      await tester.pump();
      expect(_saveEnabled(tester), isTrue);
      await tester.tap(find.byType(Switch).first); // vidriera
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);

      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'tienda');
      expect(body['season'], 'halloween');
      expect(body['businessMode'], 'vidriera');
      expect(body['accentColor'], '#C9A84C');
      expect(body['bannerIntervalSec'], 7);
      expect((body['homeSections'] as Map)['faq'], false);
      expect(find.text('Apariencia guardada y publicada'), findsOneWidget);
    });

    testWidgets('color de acento inválido no se manda', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_tienda_color', TiendaScreen(initial: _config.tienda, canEdit: true),
          height: 3000, api: api);
      await _type(tester, 'Otro color (hex)', 'rojo');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(api.calls, isEmpty);
      expect(find.textContaining('#RRGGBB'), findsOneWidget);
    });

    testWidgets('elegir "Marca Hefesto" oculta la decoración', (tester) async {
      await _show(tester, 'config_tienda_sin_temporada', TiendaScreen(initial: _config.tienda, canEdit: true),
          height: 3000);
      await tester.tap(find.text('Marca Hefesto'));
      await tester.pump();
      expect(find.text('Decoración animada'), findsNothing);
    });

    testWidgets('tocar un banner abre su edición', (tester) async {
      await _show(tester, 'config_tienda_banner', TiendaScreen(initial: _config.tienda, canEdit: true), height: 3000);
      await tester.ensureVisible(find.text('Figuras de colección'));
      await tester.tap(find.text('Figuras de colección'));
      await _settle(tester);
      expect(find.text('Mostrar en la tienda'), findsOneWidget);
      expect(find.text('Eliminar banner'), findsOneWidget);
    });
  });

  group('Banner', () {
    testWidgets('edita textos y lo oculta', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_banner', BannerEditScreen(banner: _config.tienda.banners.first, canEdit: true),
          height: 1500, api: api);
      expect(find.text('La imagen se cambia desde la web.'), findsOneWidget);
      expect(_saveEnabled(tester), isFalse);
      await _type(tester, 'Título', 'Nuevo título');
      await tester.tap(find.byType(Switch).first);
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'banner:b1');
      expect(body['title'], 'Nuevo título');
      expect(body['isActive'], false);
      expect(body['align'], 'left');
      expect(body['ctaText'], 'Ver productos');
    });

    testWidgets('el título es obligatorio', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_banner_titulo', BannerEditScreen(banner: _config.tienda.banners.first, canEdit: true),
          height: 1500, api: api);
      await _type(tester, 'Título', ' ');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(api.calls, isEmpty);
      expect(find.text('Ingresá un título.'), findsOneWidget);
    });

    testWidgets('eliminar pide confirmación', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_banner_borrar',
          Builder(builder: (context) => Scaffold(body: Center(child: ElevatedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => BannerEditScreen(banner: _config.tienda.banners.first, canEdit: true))),
            child: const Text('abrir'),
          )))),
          height: 1500, api: api);
      await tester.tap(find.text('abrir'));
      await _settle(tester);
      await tester.ensureVisible(find.text('Eliminar banner'));
      await tester.tap(find.text('Eliminar banner'));
      await _settle(tester);
      expect(find.text('Eliminar banner'), findsNWidgets(2), reason: 'botón + título del diálogo');
      await tester.tap(find.text('Eliminar').last);
      await _settle(tester);
      expect(api.calls.single, ('banner_delete', 'b1'));
      expect(find.text('abrir'), findsOneWidget, reason: 'volvió a la pantalla anterior');
    });
  });

  group('Textos clave', () {
    testWidgets('menú de textos', (tester) async {
      await _show(tester, 'config_textos',
          TextosScreen(initial: _config.textos, canEdit: true, canEditQuote: true));
      expect(find.text('Banda de confianza'), findsOneWidget);
      expect(find.text('Preguntas frecuentes'), findsOneWidget);
      expect(find.text('Cotización por WhatsApp'), findsOneWidget);
      expect(find.text('De fábrica'), findsOneWidget, reason: 'la banda nunca se editó');
    });

    testWidgets('banda de confianza: edita y guarda', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_textos_confianza', TrustBarScreen(initial: _config.textos.trustBar, canEdit: true),
          height: 1300, api: api);
      expect(find.text('ENVÍO / PRODUCCIÓN'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField).first, 'Producción en 24 h');
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'textos');
      expect((body['trustBar'] as List).first, {'ic': 'truck', 't': 'Producción en 24 h', 'd': 'Imprimimos y despachamos rápido'});
    });

    testWidgets('preguntas frecuentes: agregar, validar y guardar', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_textos_faq', FaqScreen(initial: _config.textos.faq, canEdit: true),
          height: 1500, api: api);
      await tester.tap(find.text('Agregar pregunta'));
      await tester.pump();
      expect(_saveEnabled(tester), isFalse, reason: 'una fila vacía no es un cambio');

      // Pregunta sin respuesta → error.
      await tester.enterText(find.byType(TextFormField).at(2), '¿Hacen envíos?');
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(find.text('Falta la respuesta.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await tester.enterText(find.byType(TextFormField).at(3), 'Sí, a todo el país.');
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);
      final faq = (api.calls.single.$2! as Map)['faq'] as List;
      expect(faq, hasLength(2));
      expect(faq.last, {'q': '¿Hacen envíos?', 'a': 'Sí, a todo el país.'});
    });

    testWidgets('preguntas frecuentes: no deja guardar sin ninguna', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_textos_faq_vacia', FaqScreen(initial: _config.textos.faq, canEdit: true),
          height: 1500, api: api);
      await tester.tap(find.byTooltip('Quitar pregunta').first);
      await tester.pump();
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(find.text('Cargá al menos una pregunta con su respuesta.'), findsOneWidget);
      expect(api.calls, isEmpty);
    });

    testWidgets('cotización: valida el porcentaje y guarda', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_textos_cotizacion', QuoteScreen(initial: _config.textos.quote, canEdit: true),
          height: 1500, api: api);
      await _type(tester, 'Seña (%)', '150');
      await tester.tap(_saveButton());
      await _settle(tester);
      expect(find.text('Ingresá un porcentaje entre 0 y 100.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await _type(tester, 'Seña (%)', '30');
      await tester.tap(_saveButton());
      await _settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'cotizacion');
      expect(body['depositPct'], 30);
      expect(body['notes'], ['Las dimensiones pueden variar.']);
    });

    testWidgets('cotización en solo lectura si no puede editar productos ni pedidos', (tester) async {
      await _show(tester, 'config_textos_cotizacion_ro', QuoteScreen(initial: _config.textos.quote, canEdit: false),
          height: 1500);
      expect(find.textContaining('quien puede editar productos o pedidos'), findsOneWidget);
      expect(find.text('Guardar cambios'), findsNothing);
    });
  });

  group('Equipo y roles', () {
    testWidgets('equipo: miembros, estados y botón de invitar (admin)', (tester) async {
      await _show(tester, 'config_equipo', const EquipoScreen(), height: 1000);
      expect(find.text('Equipo (3)'), findsOneWidget);
      expect(find.text('Roles (2)'), findsOneWidget);
      expect(find.text('Ale (vos)'), findsOneWidget);
      expect(find.text('Invitación pendiente'), findsOneWidget);
      expect(find.text('Invitar a alguien'), findsOneWidget);
      expect(find.text('2 activos · 1 pendiente'), findsOneWidget);
    });

    testWidgets('un no-administrador ve la lista sin controles', (tester) async {
      final ro = TeamData.fromJson({...teamJson(), 'canManage': false});
      await _show(tester, 'config_equipo_solo_ver', const EquipoScreen(),
          height: 1000, me: _me(admin: false), teamOverride: adminTeamProvider.overrideWith((ref) async => ro));
      expect(find.text('Invitar a alguien'), findsNothing);
      expect(find.textContaining('Solo un administrador puede invitar'), findsOneWidget);
      expect(find.byIcon(Icons.more_vert_rounded), findsNothing);
    });

    testWidgets('acciones sobre un miembro: cambiar rol, reenviar, quitar', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_equipo_miembro', const EquipoScreen(), height: 1000, api: api);
      await tester.tap(find.text('anto@x.com').first);
      await _settle(tester);
      expect(find.text('Reenviar invitación'), findsOneWidget);
      expect(find.text('Cambiar rol'), findsOneWidget);
      expect(find.text('Quitar acceso al panel'), findsOneWidget);

      await tester.tap(find.text('Reenviar invitación'));
      await _settle(tester);
      expect(api.calls.single, ('resend', 'u2'));
      expect(find.text('Invitación reenviada a anto@x.com'), findsOneWidget);
    });

    testWidgets('cambiar el rol de alguien', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_equipo_rol', const EquipoScreen(), height: 1000, api: api);
      await tester.tap(find.text('anto@x.com').first);
      await _settle(tester);
      await tester.tap(find.text('Cambiar rol'));
      await _settle(tester);
      expect(find.text('Elegí el rol'), findsOneWidget);
      await tester.tap(find.text('Administrador').last);
      await _settle(tester);
      expect(api.calls.single, ('assign', ('u2', 'r1')));
    });

    testWidgets('quitar acceso pide confirmación; el error del servidor se ve', (tester) async {
      final api = FakeConfigApi(failWith: 'Debe quedar al menos un administrador.');
      await _show(tester, 'config_equipo_quitar', const EquipoScreen(), height: 1000, api: api);
      await tester.tap(find.text('anto@x.com').first);
      await _settle(tester);
      await tester.tap(find.text('Quitar acceso al panel'));
      await _settle(tester);
      expect(find.textContaining('deja de poder entrar al panel'), findsOneWidget);
      await tester.tap(find.text('Quitar acceso').last);
      await _settle(tester);
      expect(find.text('Debe quedar al menos un administrador.'), findsOneWidget);
    });

    testWidgets('uno mismo y el último administrador no se pueden tocar', (tester) async {
      await _show(tester, 'config_equipo_yo', const EquipoScreen(), height: 1000);
      await tester.tap(find.text('Ale (vos)'));
      await _settle(tester);
      expect(find.textContaining('Sos vos'), findsOneWidget);
      expect(find.text('Cambiar rol'), findsNothing);
      expect(find.text('Quitar acceso al panel'), findsNothing);
    });

    testWidgets('roles: lista con resumen', (tester) async {
      await _show(tester, 'config_roles', const EquipoScreen(), height: 1000);
      await tester.tap(find.text('Roles (2)'));
      await _settle(tester);
      expect(find.text('Nuevo rol'), findsOneWidget);
      expect(find.text('Acceso total · 1 persona'), findsOneWidget);
      expect(find.text('Ve 2 de 4 módulos · 1 persona'), findsOneWidget);
      expect(find.text('Rol de sistema'), findsNWidgets(2));
    });

    testWidgets('invitar: valida el mail y manda la invitación', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_invitar', InviteScreen(roles: _team.roles), height: 1300, api: api);
      expect(find.text('Operador'), findsOneWidget);
      // El mensaje arranca con la plantilla del rol (el primero que no es admin).
      expect(find.textContaining('como Operador'), findsOneWidget);

      await _type(tester, 'Email', 'mal');
      await tester.tap(find.text('Enviar invitación'));
      await _settle(tester);
      expect(find.text('Ingresá un email válido.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await _type(tester, 'Email', 'nuevo@x.com');
      await _type(tester, 'Nombre (opcional)', 'Nuevo');
      await tester.tap(find.text('Enviar invitación'));
      await _settle(tester);
      final call = api.calls.single;
      expect(call.$1, 'invite');
      expect((call.$2! as Map)['email'], 'nuevo@x.com');
      expect((call.$2! as Map)['roleId'], 'r2');
      expect((call.$2! as Map)['fullName'], 'Nuevo');
    });

    testWidgets('rol de administrador: solo lectura', (tester) async {
      await _show(tester, 'config_rol_admin', RoleEditScreen(role: _team.roles[0], modules: _team.modules, canManage: true),
          height: 1000);
      expect(find.text('El rol Administrador tiene acceso total y no se edita.'), findsOneWidget);
      expect(find.text('Acceso total a todos los módulos.'), findsOneWidget);
      expect(find.text('Guardar cambios'), findsNothing);
    });

    testWidgets('editar un rol: matriz de permisos y guardado', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_rol_editar', RoleEditScreen(role: _team.roles[1], modules: _team.modules, canManage: true),
          height: 1500, api: api);
      expect(find.text('Auditoría'), findsOneWidget);
      expect(_saveEnabled(tester), isFalse);
      // Tilda "Ver" de Auditoría (último módulo).
      final audit = find.ancestor(of: find.text('Auditoría'), matching: find.byType(Column)).first;
      await tester.tap(find.descendant(of: audit, matching: find.widgetWithText(FilterChip, 'Ver')));
      await tester.pump();
      expect(_saveEnabled(tester), isTrue);
      await tester.tap(_saveButton());
      await _settle(tester);
      final body = api.calls.single.$2! as Map<String, dynamic>;
      expect(api.calls.single.$1, 'role_update');
      expect(body['id'], 'r2');
      expect((body['permissions'] as Map)['auditoria'], ['ver']);
      expect((body['permissions'] as Map)['pedidos'], ['ver', 'editar']);
      expect((body['permissions'] as Map).containsKey('config'), isFalse, reason: 'sin acciones no se manda');
    });

    testWidgets('rol nuevo: pide nombre', (tester) async {
      final api = FakeConfigApi();
      await _show(tester, 'config_rol_nuevo', RoleEditScreen(modules: _team.modules, canManage: true),
          height: 1500, api: api);
      expect(find.text('Borrar rol'), findsNothing);
      // Habilita guardar tildando algo, pero sin nombre.
      await tester.tap(find.widgetWithText(FilterChip, 'Ver').first);
      await tester.pump();
      await tester.tap(find.text('Crear rol'));
      await _settle(tester);
      expect(find.text('Ingresá un nombre para el rol.'), findsOneWidget);
      expect(api.calls, isEmpty);

      await _type(tester, 'Nombre del rol', 'Atención');
      await tester.tap(find.text('Crear rol'));
      await _settle(tester);
      expect(api.calls.single.$1, 'role_create');
    });

    testWidgets('no se puede borrar un rol de sistema; uno propio sí (con confirmación)', (tester) async {
      final custom = RoleInfo.fromJson({
        'id': 'r9',
        'name': 'Atención',
        'isSystem': false,
        'isAdmin': false,
        'permissions': {'pedidos': ['ver']},
        'memberCount': 0,
      });
      final api = FakeConfigApi();
      await _show(tester, 'config_rol_borrar',
          Builder(builder: (context) => Scaffold(body: Center(child: ElevatedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => RoleEditScreen(role: custom, modules: _team.modules, canManage: true))),
            child: const Text('abrir'),
          )))),
          height: 1500, api: api);
      await tester.tap(find.text('abrir'));
      await _settle(tester);
      await tester.ensureVisible(find.text('Borrar rol'));
      await tester.tap(find.text('Borrar rol'));
      await _settle(tester);
      await tester.tap(find.text('Borrar').last);
      await _settle(tester);
      expect(api.calls.single, ('role_delete', 'r9'));
      expect(find.text('abrir'), findsOneWidget);

      await _show(tester, 'config_rol_sistema', RoleEditScreen(role: _team.roles[1], modules: _team.modules, canManage: true),
          height: 1500);
      expect(find.text('Borrar rol'), findsNothing);
    });
  });

  group('Visual', () {
    testWidgets('360 de ancho y letra grande: menú y equipo', (tester) async {
      await _show(tester, 'config_menu_360', const AdminConfiguracionScreen(),
          height: 1500, width: 360, textScale: 1.6);
      await _show(tester, 'config_equipo_360', const EquipoScreen(), height: 1500, width: 360, textScale: 1.6);
      await _show(tester, 'config_tienda_360', TiendaScreen(initial: _config.tienda, canEdit: true),
          height: 4200, width: 360, textScale: 1.6);
      await _show(tester, 'config_rol_360', RoleEditScreen(role: _team.roles[1], modules: _team.modules, canManage: true),
          height: 4200, width: 360, textScale: 1.6);
    });

    testWidgets('los tres temas', (tester) async {
      for (final mode in HefestoThemeMode.values) {
        await _show(tester, 'config_menu_${mode.name}', const AdminConfiguracionScreen(), height: 1100, theme: mode);
        expect(find.text('Datos del negocio'), findsOneWidget, reason: mode.name);
        await _show(tester, 'config_tienda_${mode.name}', TiendaScreen(initial: _config.tienda, canEdit: true),
            height: 3000, theme: mode);
        await _show(tester, 'config_equipo_${mode.name}', const EquipoScreen(), height: 1000, theme: mode);
      }
    });
  });
}
