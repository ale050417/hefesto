// Tarjetas de la pantalla de Reportes. Cada una recibe ya los datos del
// servidor: acá no se calcula nada de negocio, solo se dibuja.

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/charts.dart';
import 'reportes_api.dart';
import 'reportes_models.dart';

/// "1,25 kg" / "320 g".
String formatGrams(double g) =>
    g >= 1000 ? '${formatArNumber(g / 1000, maxDecimals: 2)} kg' : '${formatArNumber(g, maxDecimals: 1)} g';

class KpiGrid extends StatelessWidget {
  const KpiGrid(this.o, {super.key});
  final ReportsOverview o;

  @override
  Widget build(BuildContext context) {
    final k = o.kpis;
    return Column(
      children: [
        KpiRow(
          left: KpiTile(
            icon: Icons.attach_money_rounded,
            label: 'Facturación ${o.year}',
            value: formatPrice(k.revenue),
            hint: '${k.salesCount} ventas',
          ),
          right: KpiTile(
            icon: Icons.receipt_long_rounded,
            label: 'Ticket promedio',
            value: formatPrice(k.avgTicket),
            color: Brand.success,
            hint: 'por venta',
          ),
        ),
        const SizedBox(height: 12),
        KpiRow(
          left: KpiTile(
            icon: Icons.inventory_2_outlined,
            label: 'Unidades vendidas',
            value: formatArNumber(k.unitsSold),
            color: Brand.info,
          ),
          right: KpiTile(
            icon: Icons.person_add_alt_1_rounded,
            label: 'Clientes nuevos ${o.year}',
            value: formatArNumber(k.newCustomers),
            color: Brand.warning,
          ),
        ),
      ],
    );
  }
}

/// Año contra año del mismo tramo (no 10 meses contra 12).
class YearOverYearCard extends StatelessWidget {
  const YearOverYearCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final y = o.yoy;
    final tramo = y.asOfMonth >= 12 ? 'el año completo' : 'enero a ${kMonthLong[y.asOfMonth - 1].toLowerCase()}';
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            '${o.year} contra ${o.prevYear}',
            subtitle: 'Comparado sobre $tramo.',
            trailing: DeltaPill(y.deltaPct),
          ),
          Row(
            children: [
              Expanded(child: _YearFigure('${o.year}', y.current, Brand.gold)),
              const SizedBox(width: 12),
              Expanded(child: _YearFigure('${o.prevYear}', y.prevSamePeriod, c.textDim)),
            ],
          ),
        ],
      ),
    );
  }
}

class _YearFigure extends StatelessWidget {
  const _YearFigure(this.label, this.value, this.color);
  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: c.textFaint, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            formatPrice(value),
            style: TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 18, color: color),
          ),
        ),
      ],
    );
  }
}

class MonthlyCard extends StatefulWidget {
  const MonthlyCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  State<MonthlyCard> createState() => _MonthlyCardState();
}

class _MonthlyCardState extends State<MonthlyCard> {
  MonthlyChartMode _mode = MonthlyChartMode.bars;

  @override
  Widget build(BuildContext context) {
    final o = widget.o;
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader('Ventas por mes', subtitle: 'Tienda y ventas manuales, en pesos.'),
          PeriodChips<MonthlyChartMode>(
            options: const [
              (MonthlyChartMode.bars, 'Barras'),
              (MonthlyChartMode.lines, 'Líneas'),
            ],
            selected: _mode,
            onSelected: (m) => setState(() => _mode = m),
          ),
          const SizedBox(height: 12),
          if (!o.hasSales && o.monthsPrev.every((v) => v <= 0))
            const _EmptyNote('Todavía no hay ventas para graficar.')
          else
            MonthlyChart(
              current: o.monthsCurrent,
              previous: o.monthsPrev,
              year: o.year,
              prevYear: o.prevYear,
              mode: _mode,
              currentUntil: o.yoy.asOfMonth,
            ),
        ],
      ),
    );
  }
}

/// Ventas por día con selector de rango (7 / 30 / 90 días).
class DailyCard extends ConsumerStatefulWidget {
  const DailyCard({super.key});

  @override
  ConsumerState<DailyCard> createState() => _DailyCardState();
}

class _DailyCardState extends ConsumerState<DailyCard> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final series = ref.watch(reportesDailyProvider(_days));
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader('Ventas por día', subtitle: 'Últimos $_days días, hasta hoy.'),
          PeriodChips<int>(
            options: const [(7, '7 días'), (30, '30 días'), (90, '90 días')],
            selected: _days,
            onSelected: (d) => setState(() => _days = d),
          ),
          const SizedBox(height: 14),
          series.when(
            loading: () => const Skeleton(height: 180, radius: 14),
            error: (e, _) => Column(
              children: [
                Text(errorMessage(e), textAlign: TextAlign.center, style: TextStyle(color: c.textDim, fontSize: 13)),
                TextButton(
                  onPressed: () => ref.invalidate(reportesDailyProvider(_days)),
                  child: const Text('Reintentar'),
                ),
              ],
            ),
            data: (s) => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RevenueChart(points: s.points, height: 150),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _MiniStat('Total', formatPrice(s.total))),
                    // "Promedio por día" no entraba en un tercio de 360 dp
                    // (se cortaba en "Promedio por …"): el "por día" va abajo.
                    Expanded(child: _MiniStat('Promedio', formatPrice(s.average), sub: 'por día')),
                    Expanded(
                      child: _MiniStat(
                        'Mejor día',
                        s.best == null ? '—' : formatPrice(s.best!.total),
                        sub: s.best == null ? null : formatDay(s.best!.date),
                      ),
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

class _MiniStat extends StatelessWidget {
  const _MiniStat(this.label, this.value, {this.sub});
  final String label;
  final String value;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: c.textFaint)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value, style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w700, fontSize: 13)),
        ),
        if (sub != null) Text(sub!, style: TextStyle(fontSize: 10.5, color: c.textFaint)),
      ],
    );
  }
}

class SourceCard extends StatelessWidget {
  const SourceCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Tienda online', Icons.storefront_rounded, o.storefront, Brand.success),
      ('Venta manual', Icons.point_of_sale_rounded, o.manual, Brand.gold),
    ];
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            'Ventas por origen · ${o.year}',
            subtitle: 'Tienda online contra lo cargado como venta manual.',
          ),
          ShareBar(parts: [for (final r in rows) (r.$3.revenue, r.$4)]),
          const SizedBox(height: 14),
          for (final r in rows) _SourceRow(label: r.$1, icon: r.$2, stat: r.$3, color: r.$4),
        ],
      ),
    );
  }
}

class _SourceRow extends StatelessWidget {
  const _SourceRow({required this.label, required this.icon, required this.stat, required this.color});
  final String label;
  final IconData icon;
  final SourceStat stat;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(11)),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                Text('${stat.count} ventas · ${stat.pct}% del total',
                    style: TextStyle(fontSize: 11.5, color: c.textFaint)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(formatPrice(stat.revenue),
              style: TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 14, color: color)),
        ],
      ),
    );
  }
}

class CategoryCard extends StatelessWidget {
  const CategoryCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final palette = chartPalette();
    final sorted = [...o.categories.where((e) => e.revenue > 0)]..sort((a, b) => b.revenue.compareTo(a.revenue));
    final top = sorted.take(5).toList();
    final restSum = sorted.skip(5).fold(0.0, (a, e) => a + e.revenue);
    final slices = [
      for (var i = 0; i < top.length; i++) DonutSlice(top[i].name, top[i].revenue, palette[i]),
      if (restSum > 0) DonutSlice('Otras', restSum, c.textFaint),
    ];
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const CardHeader('Ventas por categoría', subtitle: 'Acumulado de todos los años.'),
          if (slices.isEmpty)
            const _EmptyNote('Sin ventas por categoría todavía.')
          else
            DonutChart(slices: slices, centerLabel: 'Facturado'),
        ],
      ),
    );
  }
}

class TopProductsCard extends StatelessWidget {
  const TopProductsCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  Widget build(BuildContext context) {
    final maxQty = o.topProducts.fold<int>(1, (a, p) => math.max(a, p.qty));
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            'Productos más vendidos',
            subtitle: 'Top ${o.topProducts.isEmpty ? 6 : o.topProducts.length} de la tienda, acumulado histórico.',
          ),
          if (o.topProducts.isEmpty)
            const _EmptyNote('Sin ventas en el período.')
          else
            for (var i = 0; i < o.topProducts.length; i++)
              RankedRow(
                rank: i + 1,
                title: o.topProducts[i].name,
                subtitle: '${o.topProducts[i].qty} ${o.topProducts[i].qty == 1 ? 'unidad' : 'unidades'}',
                value: formatPrice(o.topProducts[i].revenue),
                fraction: o.topProducts[i].qty / maxQty,
              ),
        ],
      ),
    );
  }
}

class ConsumptionCard extends StatefulWidget {
  const ConsumptionCard(this.o, {super.key});
  final ReportsOverview o;

  @override
  State<ConsumptionCard> createState() => _ConsumptionCardState();
}

class _ConsumptionCardState extends State<ConsumptionCard> {
  static const _collapsed = 6;
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final o = widget.o;
    final rows = [...o.consumption]..sort((a, b) => b.grams.compareTo(a.grams));
    final shown = _all ? rows : rows.take(_collapsed).toList();
    final maxG = rows.fold<double>(1, (a, r) => math.max(a, r.grams));
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CardHeader(
            'Consumo de filamento · ${o.year}',
            subtitle: 'Gramos que salieron del stock por ventas y por fallas.',
          ),
          if (rows.isEmpty)
            const _EmptyNote('Todavía no hay consumo registrado este año.')
          else ...[
            Row(
              children: [
                Expanded(child: _MiniStat('Total', formatGrams(o.consumptionGrams))),
                Expanded(child: _MiniStat('Costo del material', formatPrice(o.consumptionCost))),
              ],
            ),
            const SizedBox(height: 6),
            for (var i = 0; i < shown.length; i++)
              RankedRow(
                rank: i + 1,
                title: [shown[i].material, if (shown[i].color != null) shown[i].color!].join(' · '),
                subtitle: '${shown[i].isFailure ? 'Fallas' : 'Ventas'} · ${formatPrice(shown[i].cost)}',
                value: formatGrams(shown[i].grams),
                fraction: shown[i].grams / maxG,
                color: shown[i].isFailure ? Brand.danger : Brand.info,
              ),
            if (rows.length > _collapsed)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _all = !_all),
                  child: Text(_all ? 'Ver menos' : 'Ver todos (${rows.length})'),
                ),
              ),
            Text(
              'El consumo por ventas sale del registro de movimientos de filamento; lo anterior a ese registro no aparece.',
              style: TextStyle(fontSize: 11, color: c.textFaint, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyNote extends StatelessWidget {
  const _EmptyNote(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Center(
          child: Text(text, textAlign: TextAlign.center, style: TextStyle(color: context.hc.textDim, fontSize: 13)),
        ),
      );
}
