import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../clientes/cliente_detail_screen.dart';
import '../crecimiento/form_kit.dart';
import 'recompensa_form_screen.dart';
import 'recompensas_models.dart';
import 'recompensas_providers.dart';
import 'recompensas_widgets.dart';

/// Recompensas: reglas del programa de puntos, estadísticas, catálogo de
/// premios (crear, editar, pausar, eliminar) y últimos canjes. (Pantalla de
/// entrada del módulo; se abre desde "Más".)
class AdminRecompensasScreen extends ConsumerWidget {
  const AdminRecompensasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('recompensas', 'crear') ?? false;
    return AdminModuleScaffold(
      title: 'Recompensas',
      permission: 'recompensas',
      what: 'las recompensas',
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              backgroundColor: Brand.gold,
              foregroundColor: Brand.goldFg,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nueva recompensa'),
              onPressed: () => _openForm(context, ref),
            )
          : null,
      body: const _RecompensasBody(),
    );
  }
}

Future<void> _openForm(BuildContext context, WidgetRef ref, {Reward? reward}) async {
  // Los productos publicados vienen en la misma respuesta de la lista.
  final products = ref.read(adminRewardsProvider).value?.products ?? const <IdName>[];
  final saved = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => RewardFormScreen(reward: reward, products: products)),
  );
  if (saved == true) ref.invalidate(adminRewardsProvider);
}

class _RecompensasBody extends ConsumerStatefulWidget {
  const _RecompensasBody();

  @override
  ConsumerState<_RecompensasBody> createState() => _RecompensasBodyState();
}

class _RecompensasBodyState extends ConsumerState<_RecompensasBody> {
  Future<void> _refresh() async {
    ref.invalidate(adminRewardsProvider);
    try {
      await ref.read(adminRewardsProvider.future);
    } catch (_) {
      // El error ya lo muestra la pantalla.
    }
  }

  Future<void> _toggle(Reward r) async {
    try {
      await updateReward(ref.read(apiClientProvider), r.id, rewardBodyWithActive(r, !r.isActive));
      ref.invalidate(adminRewardsProvider);
      if (mounted) showToast(context, r.isActive ? 'Recompensa pausada' : 'Recompensa activada');
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e));
    }
  }

  Future<void> _delete(Reward r) async {
    final ok = await confirmAction(
      context,
      title: '¿Eliminar "${r.title}"?',
      message: 'Los clientes ya no podrán canjear esta recompensa.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await deleteReward(ref.read(apiClientProvider), r.id);
      ref.invalidate(adminRewardsProvider);
      if (mounted) showToast(context, 'Recompensa eliminada');
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('recompensas', 'editar') ?? false;
    final canDelete = me?.can('recompensas', 'eliminar') ?? false;
    final canSeeCustomers = me?.can('clientes', 'ver') ?? false;
    final rewards = ref.watch(adminRewardsProvider);

    return rewards.when(
      loading: () => const ListSkeleton(rows: 5, height: 100),
      error: (e, _) => ErrorView(
        message: errorMessage(e),
        onRetry: () => ref.invalidate(adminRewardsProvider),
      ),
      data: (page) => RefreshIndicator(
        color: Brand.gold,
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
          children: [
            Row(
              children: [
                Expanded(
                  child: StatBox(
                    label: 'Recompensas',
                    value: '${page.rewards.length}',
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: StatBox(
                    label: 'En circulación',
                    value: '${page.stats.inCirculation}',
                    color: Brand.info,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: StatBox(
                    label: 'Canjes realizados',
                    value: '${page.stats.redemptions}',
                    color: Brand.success,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: StatBox(
                    label: 'Puntos canjeados',
                    value: '${page.stats.pointsRedeemed}',
                  ),
                ),
              ],
            ),
            const AdminSectionTitle('Cómo funcionan los puntos'),
            _ProgramCard(rules: page.program),
            const AdminSectionTitle('Catálogo de recompensas'),
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 10),
              child: Text(
                'Así las ve tu cliente en "Canjear puntos".',
                style: TextStyle(fontSize: 12, color: c.textFaint),
              ),
            ),
            if (page.rewards.isEmpty)
              AdminCard(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: Text(
                      'Todavía no creaste recompensas.',
                      style: TextStyle(color: c.textDim, fontSize: 13.5),
                    ),
                  ),
                ),
              )
            else
              for (final r in page.rewards) ...[
                RewardCard(
                  reward: r,
                  canEdit: canEdit,
                  canDelete: canDelete,
                  onTap: canEdit ? () => _openForm(context, ref, reward: r) : null,
                  onMenu: (a) => switch (a) {
                    'edit' => _openForm(context, ref, reward: r),
                    'toggle' => _toggle(r),
                    'delete' => _delete(r),
                    _ => null,
                  },
                ),
                const SizedBox(height: 10),
              ],
            const AdminSectionTitle('Últimos canjes'),
            if (page.recentRedemptions.isEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 4),
                child: Text('Todavía nadie canjeó puntos.', style: TextStyle(fontSize: 13, color: c.textFaint)),
              )
            else
              AdminCard(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Column(
                  children: [
                    for (var i = 0; i < page.recentRedemptions.length; i++) ...[
                      if (i > 0) Divider(height: 1, color: c.border),
                      _RedemptionRow(
                        redemption: page.recentRedemptions[i],
                        onTap: canSeeCustomers
                            ? () => Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => CustomerDetailScreen(
                                      customerId: page.recentRedemptions[i].customerId,
                                    ),
                                  ),
                                )
                            : null,
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProgramCard extends StatelessWidget {
  const _ProgramCard({required this.rules});
  final ProgramRules rules;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget line(IconData icon, String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: Brand.gold),
              const SizedBox(width: 10),
              Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: c.text, height: 1.4))),
            ],
          ),
        );

    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          line(
            Icons.add_circle_outline_rounded,
            'Tus clientes ganan 1 punto por cada ${formatPrice(rules.pointsPerAmount)} en compras entregadas.',
          ),
          line(
            Icons.swap_horiz_rounded,
            'Al canjear, 1 punto vale ${formatPrice(rules.moneyPerPoint)}.',
          ),
          line(
            Icons.redeem_rounded,
            'Los premios de descuento generan un cupón automático para el checkout; '
            'los de envío o producto los coordinás por WhatsApp.',
          ),
          const SizedBox(height: 4),
          Text(
            'Estas reglas son fijas del sistema; lo que sí podés cambiar es el catálogo de premios.',
            style: TextStyle(fontSize: 11.5, color: c.textFaint, height: 1.35),
          ),
        ],
      ),
    );
  }
}

class _RedemptionRow extends StatelessWidget {
  const _RedemptionRow({required this.redemption, this.onTap});
  final Redemption redemption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final r = redemption;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    r.customerName ?? 'Cliente sin nombre',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    r.reason,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.3),
                  ),
                  const SizedBox(height: 2),
                  Text(formatDateTime(r.createdAt), style: TextStyle(fontSize: 11, color: c.textFaint)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              '−${r.points} pts',
              style: const TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
                color: Brand.gold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
