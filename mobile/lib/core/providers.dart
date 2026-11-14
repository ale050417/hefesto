import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'api/api_client.dart';
import 'api/models.dart';
import 'theme/app_theme.dart';

/// Se inyecta en main() (necesita await antes de arrancar).
final sharedPrefsProvider = Provider<SharedPreferences>(
  (ref) => throw UnimplementedError('sharedPrefsProvider sin override'),
);

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());

/// Modo de tema (Oscuro / Claro / Luz nocturna), persistido en el dispositivo.
class ThemeModeController extends Notifier<HefestoThemeMode> {
  static const _key = 'theme_mode';

  @override
  HefestoThemeMode build() {
    final saved = ref.read(sharedPrefsProvider).getString(_key);
    return HefestoThemeMode.values.firstWhere(
      (m) => m.name == saved,
      orElse: () => HefestoThemeMode.dark,
    );
  }

  Future<void> set(HefestoThemeMode mode) async {
    state = mode;
    await ref.read(sharedPrefsProvider).setString(_key, mode.name);
  }
}

final themeModeProvider =
    NotifierProvider<ThemeModeController, HefestoThemeMode>(ThemeModeController.new);

/// Riverpod reintenta solo los proveedores que fallan (hasta 10 veces, cada vez
/// más espaciado) y mientras tanto la pantalla queda "cargando": sin red, la
/// app mostraba un círculo girando casi un minuto antes de avisar. Acá no se
/// reintenta: el error se muestra enseguida con su botón "Reintentar".
Duration? _noRetry(int retryCount, Object error) => null;

/// Vidriera de la app (marca, banners, categorías, destacados…).
final homeProvider = FutureProvider<HomeData>(
  (ref) => ref.watch(apiClientProvider).home(),
  retry: _noRetry,
);

/// Cambios de la sesión de Supabase (ingreso, salida, renovación del token,
/// link de "recuperar contraseña"…), con el evento que los produjo.
final authStateProvider = StreamProvider<AuthState>(
  (ref) => Supabase.instance.client.auth.onAuthStateChange,
);

/// Sesión de Supabase (null = visitante). Se actualiza al loguear/desloguear.
final sessionProvider = StreamProvider<Session?>((ref) async* {
  final auth = Supabase.instance.client.auth;
  yield auth.currentSession;
  await for (final change in auth.onAuthStateChange) {
    yield change.session;
  }
});

/// Id del usuario que inició sesión (null = visitante).
///
/// Cambia SOLO al entrar o salir. La sesión, en cambio, se renueva sola cada
/// hora (token nuevo): quien dependa de ella se recalcula cada vez.
final userIdProvider = Provider<String?>(
  (ref) => ref.watch(sessionProvider.select((s) => s.value?.user.id)),
);

/// Perfil + rol del usuario logueado (viene del servidor, nunca del cliente).
///
/// Depende del USUARIO y no de la sesión (2026-11-14): antes, cada renovación
/// del token volvía a pedir `/me` y el panel entero pasaba un instante por la
/// pantalla de carga —perdiendo la posición de la lista— una vez por hora.
final meProvider = FutureProvider<MeInfo?>(
  (ref) async {
    final userId = ref.watch(userIdProvider);
    if (userId == null) return null;
    return ref.watch(apiClientProvider).me();
  },
  retry: _noRetry,
);
