import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/config.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/providers.dart';
import 'auth_repository.dart';
import 'social_buttons.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _error;
  bool _needsConfirm = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final needsConfirm = await ref.read(authRepositoryProvider).signUp(
            fullName: _name.text,
            email: _email.text,
            password: _password.text,
          );
      if (!mounted) return;
      if (needsConfirm) {
        setState(() => _needsConfirm = true);
      } else {
        context.go('/cuenta');
      }
    } on AuthFailure catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    listenForSocialLogin(context, ref);
    if (_needsConfirm) return _Confirm(email: _email.text);
    final c = context.hc;
    final checks = passwordChecks(_password.text);
    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: () => context.canPop() ? context.pop() : context.go('/ingresar'))),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: BrandLogo(
                    url: ref.watch(homeProvider).value?.brand.logoUrl,
                    size: 112,
                  ),
                ),
                const SizedBox(height: 14),
                Text('Creá tu cuenta', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                Text('Es gratis y te lleva un minuto.',
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    hintText: 'Nombre y apellido',
                    prefixIcon: Icon(Icons.person_outline_rounded),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Ingresá tu nombre' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    hintText: 'Email',
                    prefixIcon: Icon(Icons.mail_outline_rounded),
                  ),
                  validator: (v) =>
                      (v == null || !v.contains('@')) ? 'Ingresá un email válido' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _password,
                  obscureText: _obscure,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Contraseña',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) => isAcceptablePassword(v ?? '')
                      ? null
                      : 'Mínimo 8 caracteres, con mayúscula, minúscula y número',
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: 4,
                  children: [
                    for (final ch in checks)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            ch.ok ? Icons.check_circle_rounded : Icons.circle_outlined,
                            size: 15,
                            color: ch.ok ? Brand.success : c.textFaint,
                          ),
                          const SizedBox(width: 5),
                          Text(ch.label,
                              style: TextStyle(
                                  fontSize: 11.5, color: ch.ok ? c.text : c.textDim)),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _confirm,
                  obscureText: _obscure,
                  decoration: const InputDecoration(
                    hintText: 'Repetí la contraseña',
                    prefixIcon: Icon(Icons.lock_reset_rounded),
                  ),
                  validator: (v) => v != _password.text ? 'Las contraseñas no coinciden' : null,
                ),
                const SizedBox(height: 20),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: Brand.danger)),
                  const SizedBox(height: 12),
                ],
                GoldButton(label: 'Crear cuenta', loading: _loading, onPressed: _submit),
                const SizedBox(height: 6),
                // Qué datos se guardan, a un toque (lo piden las tiendas de apps).
                Center(
                  child: TextButton(
                    onPressed: () => openUrl(AppConfig.privacyUrl),
                    child: Text(
                      'Al crear tu cuenta aceptás la Política de privacidad',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: c.textDim,
                        decoration: TextDecoration.underline,
                        decorationColor: c.textFaint,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                SocialButtons(
                  caption: 'o registrate con',
                  onError: (m) => setState(() => _error = m),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Confirm extends StatelessWidget {
  const _Confirm({required this.email});
  final String email;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: EmptyView(
            icon: Icons.mark_email_read_rounded,
            title: '¡Revisá tu email!',
            subtitle: 'Te mandamos un link a $email para confirmar tu cuenta. '
                'Después volvé acá e ingresá.',
            action: GoldButton(
              label: 'Ir a ingresar',
              expand: false,
              onPressed: () => context.go('/ingresar'),
            ),
          ),
        ),
      );
}
