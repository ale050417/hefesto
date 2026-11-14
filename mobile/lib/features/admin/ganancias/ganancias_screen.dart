import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/charts.dart';
import '../reportes/reportes_sections.dart' show formatGrams;
import 'cost_settings_screen.dart';
import 'ganancias_api.dart';
import 'ganancias_models.dart';
import 'shares_editor_screen.dart';
import 'shares_logic.dart';

/// Ganancias y socios: ingresos cobrados, amortización, ganancia pura, cuánto le
/// toca a cada socio y el desglose por venta. Los números salen del servidor
/// (`/api/v1/admin/ganancias`), con las mismas reglas que la web.
class AdminGananciasScreen extends ConsumerStatefulWidget {
  const AdminGananciasScreen({super.key});

  @override
  ConsumerState<AdminGananciasScreen> createState() => _AdminGananciasScreenState();
}

class _AdminGananciasScreenState extends ConsumerState<AdminGananciasScreen> {
  /// null = el mes más nuevo con ventas (lo decide el servidor); `all` = todos.
  String? _month;

  Future<void> _refresh() async {
    ref.invalidate(gananciasProvider(_month));
    try {
      await ref.read(gananciasProvider(_month).future);
    } catch (_) {
      // El error se muestra en pantalla con su "Reintentar".
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('ganancias', 'editar') ?? false;
    final data = ref.watch(gananciasProvider(_month));
    return AdminModuleScaffold(
      title: 'Ganancias y socios',
      permission: 'ganancias',
      what: 'las ganancias',
      actions: [
        IconButton(tooltip: 'Actualizar', icon: const Icon(Icons.refresh_rounded), onPressed: _refresh),
      ],
      body: data.when(
        loading: () => const AnalysisSkeleton(cards: 5),
        error: (e, _) => ErrorView(
          message: errorMessage(e, fallback: '$e'),
          onRetry: () => ref.invalidate(gananciasProvider(_month)),
        ),
        data: (o) => RefreshIndicator(
          color: Brand.gold,
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              _MonthPicker(o, onPick: (m) => setState(() => _month = m)),
              const SizedBox(height: 12),
              _Kpis(o),
              const AdminSectionTitle('Reparto'),
              _PayoutsCard(o),
              const SizedBox(height: 12),
              _SharesCard(o, canEdit: canEdit),
              const AdminSectionTitle('Costos de producción'),
              _CostsCard(o, canEdit: canEdit),
              const AdminSectionTitle('Desglose por venta'),
              _BreakdownList(o),
            ],
          ),
        ),
      ),
    );
  }
}

class _MonthPicker extends StatelessWidget {
  const _MonthPicker(this.o, {required this.onPick});
  final EarningsOverview o;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    if (o.months.isEmpty) return const SizedBox.shrink();
    return PeriodChips<String>(
      scroll: true,
      options: [
        ('all', 'Todos'),
        for (final m in o.months) (m.value, m.shortLabel),
      ],
      selected: o.selectedMonth,
      onSelected: onPick,
    );
  }
}

class _Kpis extends StatelessWidget {
  const _Kpis(this.o);
  final EarningsOverview o;

  @override
  Widget build(BuildContext context) {
    final t = o.totals;
    return Column(
      children: [
        KpiRow(
          left: KpiTile(
            icon: Icons.attach_money_rounded,
            label: 'Ingresos cobrados',
            value: formatPrice(t.ingreso),
            hint: '${t.orders} ${t.orders == 1 ? 'venta' : 'ventas'}',
          ),
          right: KpiTile(
            icon: Icons.layers_rounded,
            label: 'Amortización',
            value: formatPrice(t.amort),
            color: Brand.warning,
            hint: 'material + luz + máquina',
          ),
        ),
        const SizedBox(height: 12),
        KpiRow(
          left: KpiTile(
            icon: Icons.trending_up_rounded,
            label: 'Ganancia pura',
            value: formatPrice(t.profit),
            color: Brand.success,
            hint: '${t.profitPct}% del ingreso',
          ),
          right: KpiTile(
            icon: Icons.scale_rounded,
            label: 'Filamento usado',
            value: formatGrams(t.grams),
            color: Brand.info,
          ),
        ),
      ],
    );
  }
}

class _PayoutsCard extends StatelessWidget {
  const _PayoutsCard(this.o);
  final EarningsOverview o;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final palette = chartPalette();
    final period = o.isAll ? 'acumulada' : (o.selectedLabel ?? '');
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            'A cobrar por persona',
            subtitle: 'Sobre ${formatPrice(o.totals.profit)} de ganancia pura ${period.isEmpty ? '' : period}.'.trim(),
          ),
          if (o.payouts.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text('Agregá socios o cargá ventas para ver el reparto.',
                  style: TextStyle(color: c.textDim, fontSize: 13)),
            )
          else ...[
            ShareBar(parts: [for (var i = 0; i < o.payouts.length; i++) (o.payouts[i].amount, palette[i % palette.length])]),
            const SizedBox(height: 10),
            for (var i = 0; i < o.payouts.length; i++)
              _PayoutTile(
                payout: o.payouts[i],
                color: palette[i % palette.length],
                pct: o.totals.profit > 0 ? o.payouts[i].amount / o.totals.profit * 100 : 0,
              ),
          ],
        ],
      ),
    );
  }
}

class _PayoutTile extends StatelessWidget {
  const _PayoutTile({required this.payout, required this.color, required this.pct});
  final Payout payout;
  final Color color;
  final double pct;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final initial = payout.name.trim().isEmpty ? '?' : payout.name.trim()[0].toUpperCase();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: color,
            child: Text(initial, style: const TextStyle(color: Brand.goldFg, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(payout.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text('${formatArNumber(pct, maxDecimals: 0)}% de la ganancia',
                    style: TextStyle(fontSize: 11.5, color: c.textFaint)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(formatPrice(payout.amount),
              style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 15, color: Brand.success)),
        ],
      ),
    );
  }
}

class _SharesCard extends StatelessWidget {
  const _SharesCard(this.o, {required this.canEdit});
  final EarningsOverview o;
  final bool canEdit;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final palette = chartPalette();
    final balanced = isBalanced(o.sharesTotal);
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            'Socios y porcentajes',
            subtitle: 'Solo se divide la ganancia pura, no la amortización.',
            trailing: MiniTag(sharesTotalLabel(o.sharesTotal), icon: balanced ? Icons.check_rounded : Icons.warning_amber_rounded),
          ),
          if (o.shares.isEmpty)
            Text('Todavía no hay socios cargados.', style: TextStyle(color: c.textDim, fontSize: 13))
          else
            for (var i = 0; i < o.shares.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    Container(width: 10, height: 10, decoration: BoxDecoration(color: palette[i % palette.length], shape: BoxShape.circle)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        [o.shares[i].name, if (o.shares[i].role != null) o.shares[i].role!].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
                      ),
                    ),
                    Text(formatArPercent(o.shares[i].pct, maxDecimals: 2),
                        style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 13)),
                  ],
                ),
              ),
          if (!balanced && o.shares.isNotEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: NoticeBanner(
                'El reparto no suma 100%. Editalo para que la ganancia se divida completa.',
                icon: Icons.warning_amber_rounded,
                color: Brand.warning,
              ),
            ),
          const SizedBox(height: 10),
          if (canEdit)
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<bool>(builder: (_) => SharesEditorScreen(overview: o)),
              ),
              icon: const Icon(Icons.edit_rounded, size: 18),
              label: const Text('Editar reparto'),
            )
          else
            Text('Solo lectura: tu rol no puede editar Ganancias.',
                style: TextStyle(fontSize: 12, color: c.textFaint)),
        ],
      ),
    );
  }
}

class _CostsCard extends StatelessWidget {
  const _CostsCard(this.o, {required this.canEdit});
  final EarningsOverview o;
  final bool canEdit;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final s = o.settings;
    Widget line(String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Expanded(child: Text(label, style: TextStyle(fontSize: 13, color: c.textDim))),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
            ],
          ),
        );
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CardHeader('Configuración de costos', subtitle: 'Con esto se calcula la amortización de cada pieza.'),
          line('Precio del kWh', formatArMoney(s.kwhPrice)),
          line('Consumo de la máquina', '${formatArNumber(s.machineWatts)} W'),
          line('Vida útil', '${formatArNumber(s.machineLifeHours)} h'),
          line('Costo de mantenimiento', formatArMoney(s.maintenanceCost)),
          if (canEdit) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<bool>(builder: (_) => CostSettingsScreen(settings: s)),
              ),
              icon: const Icon(Icons.tune_rounded, size: 18),
              label: const Text('Editar costos'),
            ),
          ],
        ],
      ),
    );
  }
}

class _BreakdownList extends StatefulWidget {
  const _BreakdownList(this.o);
  final EarningsOverview o;

  @override
  State<_BreakdownList> createState() => _BreakdownListState();
}

class _BreakdownListState extends State<_BreakdownList> {
  static const _page = 25;
  int _shown = _page;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final o = widget.o;
    if (o.rows.isEmpty) {
      return const AdminCard(
        child: EmptyView(
          icon: Icons.receipt_long_rounded,
          title: 'Sin ventas cobradas',
          subtitle: 'Cuando haya pedidos confirmados o entregados aparecen acá.',
        ),
      );
    }
    final rows = o.rows.take(_shown).toList();
    return Column(
      children: [
        for (final r in rows) ...[
          _EarningsTile(r),
          const SizedBox(height: 8),
        ],
        if (o.rows.length > _shown)
          TextButton(
            onPressed: () => setState(() => _shown += _page),
            child: Text('Ver más (${o.rows.length - _shown} restantes)'),
          ),
        if (o.truncated)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Se muestran las ${o.rows.length} ventas más recientes de ${o.rowsTotal}. Los totales de arriba incluyen todas.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, color: c.textFaint),
            ),
          ),
      ],
    );
  }
}

class _EarningsTile extends StatelessWidget {
  const _EarningsTile(this.r);
  final EarningsRow r;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final palette = chartPalette();
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(r.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    Text(
                      [formatDay(r.date), if (r.customer != null) r.customer!].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: c.textFaint),
                    ),
                  ],
                ),
              ),
              if (r.manual) const Padding(padding: EdgeInsets.only(left: 8), child: MiniTag('Manual', icon: Icons.point_of_sale_rounded)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _Figure('Ingreso', formatPrice(r.ingreso), c.text)),
              Expanded(child: _Figure('Amortización', '−${formatPrice(r.amort)}', Brand.warning)),
              Expanded(child: _Figure('Ganancia', formatPrice(r.profit), Brand.success)),
            ],
          ),
          if (r.split.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 12,
              runSpacing: 4,
              children: [
                for (var i = 0; i < r.split.length; i++)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: palette[i % palette.length], shape: BoxShape.circle)),
                      const SizedBox(width: 5),
                      Text('${r.split[i].name.split(' ').first} ${formatPrice(r.split[i].amount)}',
                          style: TextStyle(fontSize: 11.5, color: c.textDim, fontWeight: FontWeight.w600)),
                    ],
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure(this.label, this.value, this.color);
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, color: c.textFaint)),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 12.5, color: color)),
        ),
      ],
    );
  }
}
