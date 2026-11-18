import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import 'reportes_api.dart';
import 'reportes_models.dart';
import 'reportes_sections.dart';

/// Reportes: KPIs del año, ventas por mes (contra el año anterior), por día con
/// selector de rango, por origen, por categoría, productos más vendidos y consumo
/// de filamento. Todo viene calculado del servidor (`/api/v1/admin/reportes`).
class AdminReportesScreen extends ConsumerStatefulWidget {
  const AdminReportesScreen({super.key});

  @override
  ConsumerState<AdminReportesScreen> createState() => _AdminReportesScreenState();
}

class _AdminReportesScreenState extends ConsumerState<AdminReportesScreen> {
  /// null = el año en curso (lo decide el servidor).
  int? _year;
  bool _exporting = false;

  Future<void> _refresh() async {
    ref.invalidate(reportesOverviewProvider(_year));
    ref.invalidate(reportesDailyProvider);
    try {
      await ref.read(reportesOverviewProvider(_year).future);
    } catch (_) {
      // El error se muestra en pantalla con su "Reintentar".
    }
  }

  Future<void> _copyCsv() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final export = await ref.read(reportesApiProvider).salesCsv(days: 365);
      await Clipboard.setData(ClipboardData(text: export.csv));
      if (!mounted) return;
      showSnack(
        context,
        export.rows == 0
            ? 'No hay ventas en los últimos 365 días.'
            : 'CSV copiado: ${export.rows} ventas de los últimos 365 días. Pegalo en una planilla.',
      );
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final overview = ref.watch(reportesOverviewProvider(_year));
    return AdminModuleScaffold(
      title: 'Reportes',
      permission: 'reportes',
      what: 'los reportes',
      actions: [
        IconButton(
          tooltip: 'Copiar ventas (CSV)',
          icon: _exporting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: AppSpinner(),
                )
              : const Icon(Icons.copy_all_rounded),
          onPressed: _exporting ? null : _copyCsv,
        ),
        IconButton(
          tooltip: 'Actualizar',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: _refresh,
        ),
      ],
      body: overview.when(
        loading: () => const AnalysisSkeleton(cards: 5),
        error: (e, _) => ErrorView(
          message: errorMessage(e, fallback: '$e'),
          onRetry: () => ref.invalidate(reportesOverviewProvider(_year)),
        ),
        data: (o) => RefreshIndicator(
          color: Brand.gold,
          onRefresh: _refresh,
          child: _Content(
            o,
            onYear: (y) => setState(() => _year = y),
          ),
        ),
      ),
    );
  }
}

class _Content extends StatelessWidget {
  const _Content(this.o, {required this.onYear});
  final ReportsOverview o;
  final ValueChanged<int> onYear;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        PeriodChips<int>(
          options: [for (final y in o.years) (y, '$y')],
          selected: o.year,
          onSelected: onYear,
        ),
        const SizedBox(height: 12),
        KpiGrid(o),
        const SizedBox(height: 12),
        YearOverYearCard(o),
        const AdminSectionTitle('Evolución'),
        MonthlyCard(o),
        const SizedBox(height: 12),
        const DailyCard(),
        const AdminSectionTitle('Origen y categorías'),
        SourceCard(o),
        const SizedBox(height: 12),
        CategoryCard(o),
        const AdminSectionTitle('Productos y filamento'),
        TopProductsCard(o),
        const SizedBox(height: 12),
        ConsumptionCard(o),
      ],
    );
  }
}
