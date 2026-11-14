import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/app_frame.dart';
import 'core/config.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Las pantallas están diseñadas para el teléfono en vertical: acostado, los
  // formularios y las hojas del panel no entran (2026-11-14).
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  // De borde a borde en Android (obligatorio desde Android 15): la app dibuja
  // detrás de las barras del sistema y cada pantalla respeta sus márgenes.
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await initializeDateFormatting('es_AR');
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );
  final prefs = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
      child: const HefestoApp(),
    ),
  );
}

class HefestoApp extends ConsumerWidget {
  const HefestoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mode = ref.watch(themeModeProvider);
    final router = ref.watch(routerProvider);

    // El link del correo de "recuperar contraseña" vuelve a la app con una
    // sesión abierta solo para eso: se lleva directo a elegir la contraseña
    // nueva, esté donde esté la persona.
    ref.listen(authStateProvider, (prev, next) {
      if (next.value?.event == AuthChangeEvent.passwordRecovery) {
        router.go('/nueva-clave');
      }
    });

    return MaterialApp.router(
      title: 'Hefesto 3D',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.of(mode),
      locale: appLocale,
      supportedLocales: appSupportedLocales,
      localizationsDelegates: appLocalizationsDelegates,
      routerConfig: router,
      // Íconos del sistema (hora, batería, barra de gestos) legibles en cada
      // modo, también en las pantallas sin barra superior (inicio, catálogo,
      // producto) y con un modal abierto.
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value: AppTheme.overlayOf(mode),
        child: appFrameBuilder(context, child),
      ),
    );
  }
}
