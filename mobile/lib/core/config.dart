import 'package:flutter/foundation.dart';

/// Configuración de la app. Todo se puede pisar con --dart-define:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.50:3000
///
/// La URL y la anon key de Supabase son PÚBLICAS por diseño (viajan en el
/// bundle de la web); la seguridad real está en los permisos del servidor.
class AppConfig {
  AppConfig._();

  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://ycdwpvdiiebekntdjnyh.supabase.co',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'sb_publishable_ofkzd-QtiIqollvhMQZQgw_ltCemTi7',
  );

  /// Sitio público (para armar los links que se comparten por WhatsApp).
  static const String siteUrl = 'https://hefesto3d.com.ar';

  /// Páginas legales de la web (las piden App Store y Play Store).
  static const String privacyUrl = '$siteUrl/privacidad';
  static const String deleteAccountUrl = '$siteUrl/eliminar-cuenta';

  /// Versión que se muestra en "Cuenta". Tiene que coincidir con `version:` de
  /// pubspec.yaml (lo verifica `test/app_config_test.dart`).
  static const String appVersion = '1.2.0';

  /// En debug apunta al servidor local (10.0.2.2 = la PC vista desde el
  /// emulador de Android); en release, a producción.
  static const String _apiOverride = String.fromEnvironment('API_BASE_URL');
  static String get apiBaseUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    return kReleaseMode ? 'https://hefesto3d.com.ar' : 'http://10.0.2.2:3000';
  }
}
