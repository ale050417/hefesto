import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show AuthChangeEvent;
import 'package:url_launcher/url_launcher.dart' show closeInAppWebView;

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import 'auth_repository.dart';

/// Logo "G" de Google (colores oficiales).
const _googleG = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18">
<path d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
<path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
<path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
<path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
</svg>
''';

/// Botones redondos de ingreso social, para login y registro.
///  • Android: Google.
///  • iPhone/iPad: Google y Apple (Apple exige ofrecer "Sign in with Apple"
///    cuando hay otro ingreso de terceros).
/// Solo aparecen los que el servidor tiene habilitados (ver
/// [socialProvidersProvider]); si no hay ninguno, no se dibuja nada.
/// El mismo botón entra o crea la cuenta; al terminar, la pantalla que lo
/// contiene navega sola cuando aparece la sesión (ver [listenForSocialLogin]).
class SocialButtons extends ConsumerStatefulWidget {
  const SocialButtons({super.key, this.caption = 'o continuá con', required this.onError});
  final String caption;

  /// Mensaje para mostrar arriba (la pantalla lo pinta en su caja de error).
  final ValueChanged<String?> onError;

  @override
  ConsumerState<SocialButtons> createState() => _SocialButtonsState();
}

class _SocialButtonsState extends ConsumerState<SocialButtons> {
  String? _busy; // 'google' | 'apple'

  Future<void> _run(String which, Future<void> Function() action) async {
    if (_busy != null) return;
    setState(() => _busy = which);
    widget.onError(null);
    try {
      await action();
    } on AuthFailure catch (e) {
      widget.onError(e.message);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final repo = ref.read(authRepositoryProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final enabled = ref.watch(socialProvidersProvider).value ?? SocialProviders.none;
    final isIOS = AuthRepository.supportsApple;
    final showGoogle = enabled.showGoogle(isIOS: isIOS);
    final showApple = enabled.showApple(isIOS: isIOS);
    if (!showGoogle && !showApple) return const SizedBox.shrink();

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: Divider(color: c.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(widget.caption, style: TextStyle(color: c.textFaint, fontSize: 12.5)),
            ),
            Expanded(child: Divider(color: c.border)),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showGoogle)
              _RoundButton(
                label: 'Continuar con Google',
                busy: _busy == 'google',
                disabled: _busy != null,
                background: Colors.white,
                border: const Color(0xFFDADCE0),
                onTap: () => _run('google', repo.signInWithGoogle),
                child: SvgPicture.string(_googleG, width: 26, height: 26),
              ),
            if (showApple) ...[
              if (showGoogle) const SizedBox(width: 18),
              _RoundButton(
                label: 'Continuar con Apple',
                busy: _busy == 'apple',
                disabled: _busy != null,
                // Apple: blanco sobre fondo oscuro, negro sobre fondo claro.
                background: dark ? Colors.white : Colors.black,
                border: dark ? Colors.white : Colors.black,
                spinnerColor: dark ? Colors.black : Colors.white,
                onTap: () => _run('apple', () async {
                  await repo.signInWithApple();
                }),
                child: Icon(Icons.apple, size: 30, color: dark ? Colors.black : Colors.white),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.label,
    required this.child,
    required this.background,
    required this.border,
    required this.onTap,
    required this.busy,
    required this.disabled,
    this.spinnerColor = const Color(0xFF3C4043),
  });

  final String label;
  final Widget child;
  final Color background;
  final Color border;
  final Color spinnerColor;
  final VoidCallback onTap;
  final bool busy;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Opacity(
        opacity: disabled && !busy ? 0.5 : 1,
        child: Material(
          color: background,
          shape: CircleBorder(side: BorderSide(color: border)),
          elevation: 1.5,
          shadowColor: Colors.black54,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: disabled ? null : onTap,
            child: SizedBox(
              width: 58,
              height: 58,
              child: Center(
                child: busy
                    ? SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4, color: spinnerColor),
                      )
                    : child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Cuando alguien inicia sesión (el login con Google vuelve por deep link, sin
/// que la pantalla haya hecho nada), lleva a la cuenta. Va dentro de `build`.
///
/// Mira el EVENTO y no solo "apareció una sesión": el link de "recuperar
/// contraseña" también abre una sesión, pero ese caso lo maneja la app entera
/// llevando a "Nueva contraseña" (ver `main.dart`); si acá se navegara igual,
/// las dos pantallas se pisarían.
void listenForSocialLogin(BuildContext context, WidgetRef ref) {
  ref.listen(authStateProvider, (prev, next) {
    if (next.value?.event != AuthChangeEvent.signedIn) return;
    closeAuthBrowser();
    if (context.mounted) context.go('/cuenta');
  });
}

/// En iPhone el ingreso con Google se abre en una hoja de Safari dentro de la
/// app; al volver la sesión por el deep link la hoja quedaría abierta encima.
/// Si no hay ninguna abierta, no hace nada.
void closeAuthBrowser() {
  if (!AuthRepository.supportsApple) return;
  closeInAppWebView().catchError((_) {});
}
