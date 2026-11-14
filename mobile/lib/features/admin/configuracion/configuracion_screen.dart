import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import 'config_api.dart';
import 'config_models.dart';
import 'config_widgets.dart';
import 'envios_screen.dart';
import 'equipo_screen.dart';
import 'negocio_screen.dart';
import 'pagos_screen.dart';
import 'textos_screen.dart';
import 'tienda_screen.dart';

/// Configuración. Menú de secciones (datos del negocio, tienda, envíos, pagos,
/// textos y equipo): cada tarjeta abre su pantalla, que se guarda por
/// separado y avisa si salís con cambios sin guardar. (Se abre desde "Más".)
class AdminConfiguracionScreen extends StatelessWidget {
  const AdminConfiguracionScreen({super.key});

  @override
  Widget build(BuildContext context) => const AdminModuleScaffold(
        title: 'Configuración',
        permission: 'config',
        what: 'la configuración',
        body: ConfigHub(),
      );
}

/// Cuerpo del menú (separado para poder probarlo).
class ConfigHub extends ConsumerWidget {
  const ConfigHub({super.key});

  void _open(BuildContext context, Widget screen) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cfgAsync = ref.watch(adminConfigProvider);
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('config', 'editar') ?? false;
    final cfg = cfgAsync.value;

    if (cfg == null) {
      if (cfgAsync.hasError) {
        return ErrorView(
          message: apiErrorText(cfgAsync.error!),
          onRetry: () => ref.invalidate(adminConfigProvider),
        );
      }
      return const ListSkeleton(rows: 6, height: 84);
    }

    final c = context.hc;
    final canQuote = (me?.can('productos', 'editar') ?? false) || (me?.can('pedidos', 'editar') ?? false);
    final season = cfg.tienda.seasons.where((s) => s.key == cfg.tienda.season).firstOrNull;
    final pay = cfg.pagos;

    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: () async {
        ref.invalidate(adminConfigProvider);
        await ref.read(adminConfigProvider.future).then((_) {}, onError: (_) {});
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
        children: [
          _Header(cfg: cfg),
          if (!canEdit)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: AdminCard(
                accent: Brand.info,
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    const Icon(Icons.visibility_rounded, size: 18, color: Brand.info),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Tu rol puede ver la configuración, pero no cambiarla.',
                        style: TextStyle(fontSize: 13, color: c.text),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const AdminSectionTitle('Tu negocio'),
          _SectionTile(
            icon: Icons.storefront_rounded,
            title: 'Datos del negocio',
            summary: _join([cfg.negocio.storeName, cfg.negocio.whatsapp]) ?? 'Nombre, contacto, redes y horarios',
            onTap: () => _open(context, NegocioScreen(initial: cfg.negocio, canEdit: canEdit)),
          ),
          const SizedBox(height: 10),
          _SectionTile(
            icon: Icons.palette_rounded,
            title: 'Tienda y apariencia',
            summary: _join([
                  cfg.tienda.isVidriera ? 'Vidriera digital' : 'Tienda con pago online',
                  season == null || season.key == 'none' ? null : season.label,
                  cfg.tienda.banners.isEmpty
                      ? null
                      : '${cfg.tienda.banners.length} banner${cfg.tienda.banners.length == 1 ? '' : 's'}',
                ]) ??
                'Modo, color, temporada y banners',
            onTap: () => _open(context, TiendaScreen(initial: cfg.tienda, canEdit: canEdit)),
          ),
          const SizedBox(height: 10),
          _SectionTile(
            icon: Icons.local_shipping_rounded,
            title: 'Envío y retiro',
            summary: [
              'Retiro ${cfg.envios.pickupEnabled ? 'sí' : 'no'}',
              'Envío ${cfg.envios.deliveryEnabled ? 'sí' : 'no'}',
              '${cfg.envios.zones.length} barrio${cfg.envios.zones.length == 1 ? '' : 's'}',
            ].join(' · '),
            onTap: () => _open(context, EnviosScreen(initial: cfg.envios, canEdit: canEdit)),
          ),
          const SizedBox(height: 10),
          _SectionTile(
            icon: Icons.account_balance_wallet_rounded,
            title: 'Medios de pago',
            summary: pay.enabledNames.isEmpty ? 'Ninguno activo' : pay.enabledNames.join(' · '),
            badge: pay.mpEnabled && !pay.mpConnected
                ? const StateChip('MercadoPago sin conectar', color: Brand.warning, icon: Icons.link_off_rounded)
                : null,
            onTap: () => _open(context, PagosScreen(initial: pay, canEdit: canEdit)),
          ),
          const AdminSectionTitle('Contenido'),
          _SectionTile(
            icon: Icons.edit_note_rounded,
            title: 'Textos clave',
            summary: 'Banda de confianza, preguntas frecuentes y cotización',
            onTap: () => _open(context, TextosScreen(initial: cfg.textos, canEdit: canEdit, canEditQuote: canQuote)),
          ),
          const AdminSectionTitle('Acceso'),
          _SectionTile(
            icon: Icons.admin_panel_settings_rounded,
            title: 'Equipo y roles',
            summary: me?.isAdmin == true
                ? 'Invitá gente, cambiá roles y permisos'
                : 'Quién entra al panel y qué puede hacer cada rol',
            onTap: () => _open(context, const EquipoScreen()),
          ),
        ],
      ),
    );
  }
}

String? _join(List<String?> parts) {
  final out = parts.where((p) => p != null && p.trim().isNotEmpty).map((p) => p!.trim()).toList();
  return out.isEmpty ? null : out.join(' · ');
}

/// Tarjeta de arriba: nombre y eslogan del negocio, con el logo.
class _Header extends StatelessWidget {
  const _Header({required this.cfg});
  final AdminConfig cfg;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final name = cfg.negocio.storeName.isEmpty ? 'Tu negocio' : cfg.negocio.storeName;
    return AdminCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          BrandLogo(url: cfg.tienda.logoUrl, size: 54),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 16),
                ),
                if (cfg.negocio.slogan.isNotEmpty)
                  Text(cfg.negocio.slogan, style: TextStyle(fontSize: 12.5, color: c.textDim)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    StateChip(
                      cfg.tienda.isVidriera ? 'Vidriera digital' : 'Vende online',
                      color: cfg.tienda.isVidriera ? Brand.info : Brand.success,
                      icon: cfg.tienda.isVidriera ? Icons.chat_rounded : Icons.shopping_cart_rounded,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta de una sección: ícono, nombre, resumen de lo que hay configurado.
class _SectionTile extends StatelessWidget {
  const _SectionTile({
    required this.icon,
    required this.title,
    required this.summary,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String title;
  final String summary;
  final VoidCallback onTap;
  final Widget? badge;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Brand.gold.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: Brand.gold, size: 23),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 2),
                Text(
                  summary,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.3),
                ),
                if (badge != null) ...[const SizedBox(height: 6), badge!],
              ],
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: c.textFaint),
        ],
      ),
    );
  }
}
