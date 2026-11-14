import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import 'admin_modules.dart';
import 'admin_widgets.dart';

/// "Más": todos los módulos del panel, agrupados como en el menú de la web y
/// filtrados por los permisos de quien entró.
class AdminMoreScreen extends ConsumerWidget {
  const AdminMoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final visible = adminModules
        .where((m) => me == null || me.can(m.permission, 'ver'))
        .toList();
    final groups = <String>[];
    for (final m in visible) {
      if (!groups.contains(m.group)) groups.add(m.group);
    }

    return Scaffold(
      appBar: const AdminAppBar(title: 'Más'),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
        children: [
          for (final g in groups) ...[
            AdminSectionTitle(g),
            AdminCard(
              padding: EdgeInsets.zero,
              child: Column(
                children: [
                  for (final (i, m) in visible.where((m) => m.group == g).indexed) ...[
                    if (i > 0) Divider(height: 1, indent: 66, color: c.border),
                    _ModuleTile(m),
                  ],
                ],
              ),
            ),
          ],
          if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: AccessDenied(what: 'los módulos del panel'),
            ),
          const SizedBox(height: 22),
          AdminCard(
            padding: EdgeInsets.zero,
            child: ListTile(
              leading: const Icon(Icons.storefront_rounded, color: Brand.gold),
              title: const Text('Volver a la tienda', style: TextStyle(fontWeight: FontWeight.w600)),
              trailing: Icon(Icons.chevron_right_rounded, color: c.textFaint),
              onTap: () => context.go('/cuenta'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModuleTile extends StatelessWidget {
  const _ModuleTile(this.m);
  final AdminModuleInfo m;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return InkWell(
      // `go` si el módulo es una pestaña del panel (filamentos), `push` si es una pantalla.
      onTap: () => m.route.startsWith('/admin/m/') ? context.push(m.route) : context.go(m.route),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Brand.gold.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(m.icon, size: 20, color: Brand.gold),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(m.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                  Text(m.subtitle, style: TextStyle(color: c.textDim, fontSize: 12)),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.textFaint),
          ],
        ),
      ),
    );
  }
}
