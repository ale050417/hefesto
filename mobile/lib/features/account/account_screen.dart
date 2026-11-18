import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/config.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../auth/auth_repository.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final session = ref.watch(sessionProvider).value;
    final me = ref.watch(meProvider);
    final brand = ref.watch(homeProvider).value?.brand;
    final mode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Mi cuenta', style: Theme.of(context).textTheme.headlineSmall),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          if (session == null)
            _GuestCard(isVidriera: brand?.isVidriera ?? false)
          else
            me.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: AppSpinner()),
              ),
              error: (e, _) => _ProfileCard(
                name: session.user.email ?? 'Mi cuenta',
                email: session.user.email,
                badge: null,
              ),
              data: (m) => _ProfileCard(
                name: m?.fullName?.isNotEmpty == true ? m!.fullName! : (m?.email ?? 'Mi cuenta'),
                email: m?.email,
                badge: m?.isStaff == true ? (m!.role == 'admin' ? 'Administrador' : 'Operador') : null,
              ),
            ),
          if (me.value?.isStaff == true) ...[
            const SizedBox(height: 14),
            _Tile(
              icon: Icons.dashboard_customize_rounded,
              title: 'Panel de administración',
              subtitle: 'Pedidos, producción, stock y más',
              highlight: true,
              onTap: () => context.push('/admin'),
            ),
          ],
          const SizedBox(height: 22),
          _Heading('Apariencia'),
          // Material (y no un Container con fondo): así se ve el efecto de
          // toque de cada fila.
          Material(
            color: c.surface1,
            clipBehavior: Clip.antiAlias,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: BorderSide(color: c.border),
            ),
            child: Column(
              children: [
                for (final m in HefestoThemeMode.values) ...[
                  if (m != HefestoThemeMode.values.first) Divider(height: 1, color: c.border),
                  ListTile(
                    leading: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Brand.gold.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(m.icon, size: 20, color: Brand.gold),
                    ),
                    title: Text(m.label, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(m.hint, style: TextStyle(color: c.textDim, fontSize: 12)),
                    trailing: mode == m
                        ? const Icon(Icons.check_circle_rounded, color: Brand.gold)
                        : null,
                    onTap: () => ref.read(themeModeProvider.notifier).set(m),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 22),
          _Heading('Contacto'),
          if (brand?.whatsapp != null)
            _Tile(
              icon: Icons.chat_rounded,
              title: 'WhatsApp',
              subtitle: brand!.whatsapp!,
              onTap: () => openWhatsapp(brand.whatsapp, '¡Hola! Quería hacer una consulta.'),
            ),
          if (brand?.instagram != null) ...[
            const SizedBox(height: 8),
            _Tile(
              icon: Icons.camera_alt_rounded,
              title: 'Instagram',
              subtitle: brand!.instagram!,
              onTap: () => openUrl(
                  'https://instagram.com/${brand.instagram!.replaceAll('@', '')}'),
            ),
          ],
          const SizedBox(height: 22),
          _Heading('Legal'),
          _Tile(
            icon: Icons.privacy_tip_outlined,
            title: 'Política de privacidad',
            subtitle: 'Qué datos usamos y para qué',
            onTap: () => _open(context, AppConfig.privacyUrl),
          ),
          if (session != null) ...[
            const SizedBox(height: 22),
            _Heading('Tu cuenta'),
            _Tile(
              icon: Icons.logout_rounded,
              title: 'Cerrar sesión',
              onTap: () => _signOut(context, ref),
            ),
            const SizedBox(height: 8),
            _Tile(
              key: const Key('delete_account'),
              icon: Icons.person_remove_outlined,
              title: 'Eliminar mi cuenta',
              subtitle: 'Borra tu cuenta y tus datos',
              danger: true,
              onTap: () => _deleteAccount(context, ref, isStaff: me.value?.isStaff ?? false),
            ),
          ],
          const SizedBox(height: 28),
          Center(
            child: Text('Hefesto 3D · v${AppConfig.appVersion}',
                style: TextStyle(color: c.textFaint, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context, String url) async {
    final ok = await openUrl(url);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No pudimos abrir el enlace.')),
      );
    }
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(authRepositoryProvider).signOut();
    } on AuthFailure catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Baja de la cuenta desde la app (la exigen App Store y Play Store,
  /// 2026-11-14). El servidor es el que borra; acá se confirma, se avisa y se
  /// cierra la sesión del teléfono.
  Future<void> _deleteAccount(BuildContext context, WidgetRef ref, {required bool isStaff}) async {
    final deleted = await showDialog<bool>(
      context: context,
      builder: (_) => _DeleteAccountDialog(isStaff: isStaff),
    );
    if (deleted != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      // La cuenta ya no existe en el servidor: esto limpia la sesión guardada.
      await ref.read(authRepositoryProvider).signOut();
    } on AuthFailure {
      // Sin red justo ahora: la sesión guardada deja de servir igual.
    }
    messenger.showSnackBar(const SnackBar(content: Text('Tu cuenta fue eliminada.')));
  }
}

class _DeleteAccountDialog extends ConsumerStatefulWidget {
  const _DeleteAccountDialog({required this.isStaff});
  final bool isStaff;

  @override
  ConsumerState<_DeleteAccountDialog> createState() => _DeleteAccountDialogState();
}

class _DeleteAccountDialogState extends ConsumerState<_DeleteAccountDialog> {
  bool _busy = false;
  String? _error;

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).deleteAccount();
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'No pudimos eliminar la cuenta. Probá de nuevo.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.isStaff) {
      return AlertDialog(
        scrollable: true,
        title: const Text('Cuenta del equipo'),
        content: const Text(
          'Las cuentas del equipo las da de baja un administrador desde '
          'Configuración → Equipo.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Entendido')),
        ],
      );
    }
    return AlertDialog(
      scrollable: true,
      title: const Text('¿Eliminar tu cuenta?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Se borran tu cuenta y tus datos: nombre, direcciones, favoritos y '
            'puntos. Si hiciste compras, solo se conserva el registro que exige '
            'la ley, ya sin tu cuenta.\n\nNo se puede deshacer.',
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Brand.danger, fontWeight: FontWeight.w600)),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('confirm_delete_account'),
          style: FilledButton.styleFrom(backgroundColor: Brand.danger, foregroundColor: Colors.white),
          onPressed: _busy ? null : _confirm,
          child: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: AppSpinner(color: Colors.white),
                )
              : const Text('Eliminar'),
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 0, 10),
        child: Text(
          text.toUpperCase(),
          style: TextStyle(
            fontFamily: 'Orbitron',
            fontSize: 10.5,
            letterSpacing: 2,
            fontWeight: FontWeight.w700,
            color: context.hc.textFaint,
          ),
        ),
      );
}

class _GuestCard extends StatelessWidget {
  const _GuestCard({required this.isVidriera});
  final bool isVidriera;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Ingresá a Hefesto 3D', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            isVidriera
                ? 'Acceso para el equipo y clientes registrados.'
                : 'Seguí tus pedidos, juntá puntos y guardá tus favoritos.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          GoldButton(label: 'Ingresar', onPressed: () => context.push('/ingresar')),
          const SizedBox(height: 10),
          Center(
            child: TextButton(
              onPressed: () => context.push('/registro'),
              child: const Text('Crear una cuenta', style: TextStyle(color: Brand.gold)),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.name, required this.email, required this.badge});
  final String name;
  final String? email;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: const BoxDecoration(gradient: Brand.goldGradient, shape: BoxShape.circle),
            child: Text(initial,
                style: const TextStyle(
                    fontFamily: 'Orbitron',
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: Brand.goldFg)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium),
                if (email != null)
                  Text(email!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall),
                if (badge != null) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(
                      color: Brand.gold.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(badge!,
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w700, color: Brand.gold)),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    required this.onTap,
    this.highlight = false,
    this.danger = false,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final bool highlight;

  /// Acción destructiva (ícono y título en rojo).
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final accent = danger ? Brand.danger : Brand.gold;
    return Material(
      color: highlight ? Brand.gold.withValues(alpha: 0.12) : c.surface1,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: highlight ? Brand.gold.withValues(alpha: 0.5) : c.border),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, size: 20, color: accent),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontWeight: FontWeight.w600, color: danger ? Brand.danger : c.text),
                    ),
                    if (subtitle != null)
                      Text(subtitle!, style: TextStyle(color: c.textDim, fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: c.textFaint),
            ],
          ),
        ),
      ),
    );
  }
}
