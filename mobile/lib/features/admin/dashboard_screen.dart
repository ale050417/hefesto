import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import 'admin_providers.dart';
import 'admin_widgets.dart';
import 'sale_status.dart';
import 'stock_screen.dart';

String _capitalize(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

/// Inicio del panel: lo que importa del negocio de un vistazo.
class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(adminDashboardProvider);
    try {
      await ref.read(adminDashboardProvider.future);
    } catch (_) {
      // El error ya lo muestra la pantalla.
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(adminDashboardProvider);
    final me = ref.watch(meProvider).value;

    return Scaffold(
      appBar: const AdminAppBar(title: 'Inicio'),
      body: dash.when(
        loading: () => ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          children: const [
            Skeleton(height: 28, width: 180),
            SizedBox(height: 16),
            Skeleton(height: 250, radius: 24),
            SizedBox(height: 14),
            Skeleton(height: 86, radius: 20),
            SizedBox(height: 14),
            Skeleton(height: 120, radius: 20),
          ],
        ),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(adminDashboardProvider),
        ),
        data: (d) {
          final c = context.hc;
          final canSales = me?.can('pedidos', 'ver') ?? true;
          final canStock = me?.can('filamentos', 'ver') ?? true;
          final canQueue = me?.can('produccion', 'ver') ?? false;
          final name = d.greetingName ?? me?.fullName?.split(' ').first;
          final delta7 = d.last30 > 0 ? d.last7 / d.last30 : 0.0;

          return RefreshIndicator(
            color: Brand.gold,
            onRefresh: () => _refresh(ref),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 0, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name == null ? 'Hola' : 'Hola, $name',
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _capitalize(formatLongDay(DateTime.now())),
                        style: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (d.degraded.isNotEmpty) ...[
                  _DegradedNotice(d.degraded),
                  const SizedBox(height: 12),
                ],
                // --- Ventas de los últimos 30 días ---
                AdminCard(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
                  accent: Brand.gold,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'VENTAS DE LOS ÚLTIMOS 30 DÍAS',
                        style: TextStyle(
                          fontFamily: 'Orbitron',
                          fontSize: 10,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700,
                          color: Brand.gold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.centerLeft,
                        child: Text(
                          formatPrice(d.last30),
                          style: const TextStyle(
                            fontFamily: 'Orbitron',
                            fontWeight: FontWeight.w800,
                            fontSize: 32,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                            decoration: BoxDecoration(
                              color: Brand.gold.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              '7 días: ${formatPrice(d.last7)}',
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Brand.gold,
                              ),
                            ),
                          ),
                          if (d.last30 > 0)
                            Text(
                              '${(delta7 * 100).round()}% del mes',
                              style: TextStyle(fontSize: 11.5, color: c.textDim),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      RevenueChart(points: d.series),
                    ],
                  ),
                ),
                // --- Pedidos en curso ---
                const AdminSectionTitle('Pedidos en curso'),
                Row(
                  children: [
                    Expanded(
                      child: _FlowTile(
                        status: SaleStatus.pendingPayment,
                        label: 'Por cobrar',
                        count: d.pendingPayment,
                        onTap: canSales
                            ? () => context.go('/admin/ventas?status=pending_payment')
                            : null,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _FlowTile(
                        status: SaleStatus.inProduction,
                        label: 'En producción',
                        count: d.inProduction,
                        // El servidor cuenta acá los pagos confirmados MÁS los
                        // que ya se están imprimiendo (igual que la web, donde
                        // este número abre la cola). Filtrar Ventas por un
                        // solo estado mostraba menos pedidos que el número.
                        onTap: canQueue
                            ? () => context.push('/admin/m/produccion')
                            : (canSales ? () => context.go('/admin/ventas?status=in_production') : null),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _FlowTile(
                        status: SaleStatus.ready,
                        label: 'Listos',
                        count: d.ready,
                        onTap:
                            canSales ? () => context.go('/admin/ventas?status=ready') : null,
                      ),
                    ),
                  ],
                ),
                // --- Totales ---
                const AdminSectionTitle('Resumen'),
                Row(
                  children: [
                    Expanded(
                      child: KpiTile(
                        icon: Icons.payments_rounded,
                        label: 'Facturado',
                        hint: 'Histórico',
                        value: formatPrice(d.revenue),
                        color: Brand.success,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: KpiTile(
                        icon: Icons.shopping_bag_rounded,
                        label: 'Ventas',
                        hint: 'Tienda + mostrador',
                        value: '${d.salesCount}',
                        color: Brand.info,
                        onTap: canSales ? () => context.go('/admin/ventas') : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: KpiTile(
                        icon: Icons.local_offer_rounded,
                        label: 'Ticket promedio',
                        hint: 'Por venta',
                        value: formatPrice(d.salesCount > 0 ? d.revenue / d.salesCount : 0),
                        color: Brand.warning,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: KpiTile(
                        icon: Icons.warning_amber_rounded,
                        label: 'Filamento bajo',
                        hint: d.lowStockCount > 0 ? 'Por reponer' : 'Todo en orden',
                        value: '${d.lowStockCount}',
                        color: d.lowStockCount > 0 ? Brand.danger : Brand.success,
                        onTap: canStock ? () => context.go('/admin/stock') : null,
                      ),
                    ),
                  ],
                ),
                // --- Últimos pedidos ---
                if (canSales) ...[
                  AdminSectionTitle(
                    'Últimos pedidos',
                    action: 'Ver todas',
                    onAction: () => context.go('/admin/ventas'),
                  ),
                  if (d.recent.isEmpty)
                    const AdminCard(
                      child: Center(child: Text('Todavía no hay pedidos online.')),
                    )
                  else
                    for (final r in d.recent) ...[
                      SaleTile(
                        row: r,
                        onTap: () => context.push('/admin/venta/${r.source}/${r.id}'),
                      ),
                      const SizedBox(height: 10),
                    ],
                ],
                // --- Alertas de stock ---
                if (d.lowStock.isNotEmpty && canStock) ...[
                  AdminSectionTitle(
                    'Filamentos por reponer',
                    action: 'Ver stock',
                    onAction: () => context.go('/admin/stock'),
                  ),
                  for (final f in d.lowStock.take(5)) ...[
                    FilamentTile(f: f),
                    const SizedBox(height: 10),
                  ],
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FlowTile extends StatelessWidget {
  const _FlowTile({
    required this.status,
    required this.label,
    required this.count,
    this.onTap,
  });
  final SaleStatus status;
  final String label;
  final int count;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
      accent: count > 0 ? status.color : null,
      child: Column(
        children: [
          Icon(status.icon, color: status.color, size: 24),
          const SizedBox(height: 8),
          // Un número de 4 cifras con letra grande se partía en dos renglones.
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              '$count',
              maxLines: 1,
              style: TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w800,
                fontSize: 24,
                color: count > 0 ? status.color : c.textFaint,
              ),
            ),
          ),
          const SizedBox(height: 2),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: TextStyle(fontSize: 11.5, color: c.textDim, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _DegradedNotice extends StatelessWidget {
  const _DegradedNotice(this.items);
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return AdminCard(
      accent: Brand.warning,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: Brand.warning, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'No pudimos cargar ${items.join(', ')}. Los números pueden estar incompletos: '
              'deslizá hacia abajo para reintentar.',
              style: const TextStyle(fontSize: 12.5, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}
