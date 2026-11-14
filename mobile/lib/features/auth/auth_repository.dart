import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config.dart';

/// Reglas de contraseña: idénticas a la web (password-strength.ts).
class PasswordCheck {
  PasswordCheck(this.label, this.ok);
  final String label;
  final bool ok;
}

List<PasswordCheck> passwordChecks(String p) => [
      PasswordCheck('Al menos 8 caracteres', p.length >= 8),
      PasswordCheck('Una mayúscula', RegExp(r'[A-ZÁÉÍÓÚÑ]').hasMatch(p)),
      PasswordCheck('Una minúscula', RegExp(r'[a-záéíóúñ]').hasMatch(p)),
      PasswordCheck('Un número', RegExp(r'\d').hasMatch(p)),
    ];

bool isAcceptablePassword(String p) => passwordChecks(p).every((c) => c.ok);

class AuthFailure implements Exception {
  AuthFailure(this.message);
  final String message;
  @override
  String toString() => message;
}

/// Login/registro contra Supabase Auth. La sesión (y su refresco) la maneja
/// supabase_flutter; los permisos los decide el servidor con el JWT.
class AuthRepository {
  GoTrueClient get _auth => Supabase.instance.client.auth;

  Future<void> signIn(String email, String password) async {
    try {
      await _auth.signInWithPassword(email: email.trim(), password: password);
    } on AuthException catch (e) {
      throw AuthFailure(_translate(e));
    } catch (_) {
      throw AuthFailure('No pudimos conectarnos. Revisá tu conexión.');
    }
  }

  /// Devuelve true si hay que confirmar el email antes de entrar.
  Future<bool> signUp({
    required String fullName,
    required String email,
    required String password,
  }) async {
    try {
      final res = await _auth.signUp(
        email: email.trim(),
        password: password,
        data: {'full_name': fullName.trim()},
        emailRedirectTo: '${AppConfig.siteUrl}/auth/callback?next=/',
      );
      return res.session == null;
    } on AuthException catch (e) {
      throw AuthFailure(_translate(e));
    } catch (_) {
      throw AuthFailure('No pudimos conectarnos. Revisá tu conexión.');
    }
  }

  /// Manda el correo de "recuperar contraseña". El link vuelve a la APP (mismo
  /// esquema que el ingreso con Google) y abre la pantalla "Nueva contraseña".
  ///
  /// Antes apuntaba a una página de la web que no puede completar el cambio:
  /// el pedido lo inicia la app y solo la app tiene la clave para canjear el
  /// link (flujo PKCE), así que el cliente caía en "El link no es válido"
  /// (2026-11-14).
  Future<void> resetPassword(String email) async {
    try {
      await _auth.resetPasswordForEmail(email.trim(), redirectTo: oauthRedirect);
    } catch (_) {
      // Mismo criterio que la web: no revelamos si el email existe.
    }
  }

  /// Define la contraseña nueva. Se usa después de tocar el link de
  /// recuperación, que deja una sesión abierta solo para esto.
  Future<void> updatePassword(String password) async {
    try {
      await _auth.updateUser(UserAttributes(password: password));
    } on AuthException catch (e) {
      throw AuthFailure(_translate(e));
    } catch (_) {
      throw AuthFailure('No pudimos conectarnos. Revisá tu conexión.');
    }
  }

  /// Cierra la sesión. Lanza [AuthFailure] si no se pudo (sin conexión): la
  /// pantalla tiene que avisarlo, no quedarse muda.
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } catch (_) {
      throw AuthFailure('No pudimos cerrar la sesión. Revisá tu conexión y probá de nuevo.');
    }
  }

  // --- Ingreso / registro social ---------------------------------------
  // Con Google y con Apple el MISMO botón sirve para entrar y para crear la
  // cuenta: si el email no existe, Supabase la crea (y un trigger arma el
  // perfil), igual que en la web.

  /// Vuelta del navegador al app (esquema propio, ver AndroidManifest/Info.plist).
  /// Tiene que estar en Supabase → Authentication → URL Configuration → Redirect URLs.
  static const oauthRedirect = 'ar.com.hefesto3d.hefesto://login-callback';

  /// Apple solo se ofrece en iPhone/iPad (en Android no corresponde).
  static bool get supportsApple => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;

  /// Abre Google en el navegador. La sesión llega después, por el deep link, y
  /// la recibe `sessionProvider`: esta función solo dispara el flujo.
  Future<void> signInWithGoogle() async {
    try {
      final opened = await _auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: oauthRedirect,
        authScreenLaunchMode: LaunchMode.externalApplication,
      );
      if (!opened) throw AuthFailure('No pudimos abrir el acceso con Google. Probá de nuevo.');
    } on AuthFailure {
      rethrow;
    } on AuthException catch (e) {
      throw AuthFailure(_translate(e));
    } catch (_) {
      throw AuthFailure('No pudimos abrir el acceso con Google. Revisá tu conexión.');
    }
  }

  /// Apple nativo (hoja de Face ID del sistema). Devuelve `false` si la persona
  /// canceló, para que la pantalla no muestre un error.
  Future<bool> signInWithApple() async {
    final rawNonce = _randomNonce();
    final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
    try {
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: [AppleIDAuthorizationScopes.email, AppleIDAuthorizationScopes.fullName],
        nonce: hashedNonce,
      );
      final idToken = credential.identityToken;
      if (idToken == null) throw AuthFailure('Apple no devolvió la identidad. Probá de nuevo.');
      await _auth.signInWithIdToken(
        provider: OAuthProvider.apple,
        idToken: idToken,
        nonce: rawNonce,
      );
      // Apple manda el nombre SOLO la primera vez: hay que guardarlo ahora.
      final name = [credential.givenName, credential.familyName]
          .whereType<String>()
          .join(' ')
          .trim();
      if (name.isNotEmpty) {
        await _auth.updateUser(UserAttributes(data: {'full_name': name}));
      }
      return true;
    } on SignInWithAppleAuthorizationException catch (e) {
      if (e.code == AuthorizationErrorCode.canceled) return false;
      throw AuthFailure('No pudimos ingresar con Apple. Probá de nuevo.');
    } on AuthFailure {
      rethrow;
    } on AuthException catch (e) {
      throw AuthFailure(_translate(e));
    } catch (_) {
      throw AuthFailure('No pudimos ingresar con Apple. Revisá tu conexión.');
    }
  }

  String _randomNonce([int length = 32]) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => chars[random.nextInt(chars.length)]).join();
  }

  String _translate(AuthException e) {
    final m = e.message.toLowerCase();
    if (m.contains('invalid login')) return 'Email o contraseña incorrectos.';
    if (m.contains('email not confirmed')) {
      return 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.';
    }
    if (m.contains('already registered') || m.contains('already been registered')) {
      return 'No se pudo crear la cuenta. Puede que el email ya esté en uso.';
    }
    if (m.contains('provider is not enabled') || m.contains('unsupported provider')) {
      return 'Este tipo de ingreso todavía no está habilitado. Usá tu email y contraseña.';
    }
    if (m.contains('rate limit') || m.contains('too many')) {
      return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    }
    if (m.contains('different from the old password') || m.contains('same password')) {
      return 'La contraseña nueva tiene que ser distinta de la anterior.';
    }
    if (m.contains('weak') || m.contains('should be at least')) {
      return 'La contraseña es muy débil. Usá al menos 8 caracteres, con mayúscula, minúscula y número.';
    }
    if (m.contains('session missing') || m.contains('session_not_found') || m.contains('not authenticated')) {
      return 'El link venció. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
    }
    return 'No pudimos completar la operación. Probá de nuevo.';
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) => AuthRepository());

/// Qué ingresos sociales tiene habilitados el servidor (Supabase →
/// Authentication → Providers). La app pregunta en vez de asumir: así un
/// botón nunca lleva a un error de "ingreso no habilitado", y cuando se
/// habilita uno nuevo aparece solo, sin publicar otra versión.
@immutable
class SocialProviders {
  const SocialProviders({this.google = false, this.apple = false});
  final bool google;
  final bool apple;

  /// Sin datos (sin red, error): solo email y contraseña.
  static const none = SocialProviders();

  /// ¿Mostrar el botón de Google en este teléfono?
  ///
  /// En iPhone, Apple exige ofrecer "Iniciar sesión con Apple" siempre que haya
  /// otro ingreso de terceros (regla 4.8 de la App Store): Google se muestra
  /// SOLO si el de Apple también está habilitado. Si no, la app publicada
  /// sería rechazada en la revisión.
  bool showGoogle({required bool isIOS}) => google && (!isIOS || apple);

  bool showApple({required bool isIOS}) => isIOS && apple;

  factory SocialProviders.fromSettings(Map<String, dynamic>? json) {
    // Una respuesta con otra forma no rompe nada: queda "ninguno".
    final raw = json?['external'];
    final external = raw is Map ? raw : const {};
    return SocialProviders(
      google: external['google'] == true,
      apple: external['apple'] == true,
    );
  }
}

/// Consulta pública de Supabase (no lleva datos del usuario).
final socialProvidersProvider = FutureProvider<SocialProviders>((ref) async {
  try {
    final dio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
      ),
    );
    final res = await dio.get<Map<String, dynamic>>(
      '${AppConfig.supabaseUrl}/auth/v1/settings',
      options: Options(headers: {'apikey': AppConfig.supabaseAnonKey}),
    );
    return SocialProviders.fromSettings(res.data);
  } catch (_) {
    return SocialProviders.none;
  }
});
