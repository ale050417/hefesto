import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../reportes/reportes_sections.dart' show formatGrams;
import 'calc_logic.dart';
import 'calculadora_api.dart';
import 'calculadora_models.dart';

/// Historial de cálculos guardados, con estadísticas, búsqueda y orden.
class CalcHistoryTab extends ConsumerStatefulWidget {
  const CalcHistoryTab({super.key, required this.overview, required this.canDelete});
  final CalcOverview overview;

  /// Permiso `calculadora/eliminar`.
  final bool canDelete;

  @override
  ConsumerState<CalcHistoryTab> createState() => _CalcHistoryTabState();
}

class _CalcHistoryTabState extends ConsumerState<CalcHistoryTab> {
  final _search = TextEditingController();
  HistorySort _sort = HistorySort.recent;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(calculadoraProvider);
    try {
      await ref.read(calculadoraProvider.future);
    } catch (_) {}
  }

  Future<void> _open(CalcHistoryItem h) async {
    final deleted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _HistoryDetailSheet(item: h, canDelete: widget.canDelete),
    );
    if (deleted == true) {
      ref.invalidate(calculadoraProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final o = widget.overview;
    final s = o.stats;
    final items = filterHistory(o.history, query: _search.text, sort: _sort);
    final tiles = <Widget>[
      if (o.isAdmin && s.ganancia != null)
        KpiTile(icon: Icons.trending_up_rounded, label: 'Ganancias calculadas', value: formatArMoney(s.ganancia!, decimals: 0), color: Brand.success),
      KpiTile(icon: Icons.calculate_rounded, label: 'Piezas presupuestadas', value: formatArNumber(s.count), color: Brand.gold),
      KpiTile(icon: Icons.scale_rounded, label: 'Material consumido', value: formatGrams(s.grams), color: Brand.info),
      KpiTile(icon: Icons.schedule_rounded, label: 'Horas impresas', value: '${formatArNumber(s.hours, maxDecimals: 1)} h', color: Brand.warning),
      if (o.isAdmin && s.precioFinal != null)
        KpiTile(icon: Icons.attach_money_rounded, label: 'Facturación estimada', value: formatArMoney(s.precioFinal!, decimals: 0)),
    ];
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: _refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          KpiPairs(tiles),
          const AdminSectionTitle('Cálculos guardados'),
          TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Buscar pieza o cliente…',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => setState(_search.clear)),
            ),
          ),
          const SizedBox(height: 10),
          PeriodChips<HistorySort>(
            scroll: true,
            options: [for (final v in HistorySort.values) (v, v.label)],
            selected: _sort,
            onSelected: (v) => setState(() => _sort = v),
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 24),
              child: EmptyView(
                icon: o.history.isEmpty ? Icons.history_rounded : Icons.search_off_rounded,
                title: o.history.isEmpty ? 'Todavía no guardaste cálculos' : 'Sin resultados',
                subtitle: o.history.isEmpty
                    ? 'Armá un presupuesto en "Calcular" y guardalo para verlo acá.'
                    : 'Probá con otra búsqueda.',
              ),
            )
          else
            for (final h in items) ...[
              _HistoryTile(h, onTap: () => _open(h)),
              const SizedBox(height: 8),
            ],
          if (o.history.length >= 200)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Se muestran los últimos 200 cálculos.',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, color: c.textFaint)),
            ),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile(this.h, {required this.onTap});
  final CalcHistoryItem h;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final sub = [
      if (h.customer != null) h.customer!,
      if (h.materialLabel.isNotEmpty) h.materialLabel,
    ].join(' · ');
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(h.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                if (sub.isNotEmpty)
                  Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.textDim)),
                const SizedBox(height: 4),
                Text(
                  '${formatGrams(h.grams)} · ${formatDuration(h.hours)} · ${formatDay(h.createdAt)}',
                  style: TextStyle(fontSize: 11.5, color: c.textFaint),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(formatArMoney(h.precioFinal, decimals: 0),
              style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 14, color: Brand.gold)),
        ],
      ),
    );
  }
}

class _HistoryDetailSheet extends ConsumerStatefulWidget {
  const _HistoryDetailSheet({required this.item, required this.canDelete});
  final CalcHistoryItem item;
  final bool canDelete;

  @override
  ConsumerState<_HistoryDetailSheet> createState() => _HistoryDetailSheetState();
}

class _HistoryDetailSheetState extends ConsumerState<_HistoryDetailSheet> {
  bool _deleting = false;
  String? _error;

  Future<void> _delete() async {
    final ok = await confirmDialog(
      context,
      title: 'Eliminar cálculo',
      message: '¿Eliminar "${widget.item.name}" del historial? No se puede deshacer.',
    );
    if (!ok || !mounted) return;
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      await ref.read(calculadoraApiProvider).deleteCalc(widget.item.id);
      if (!mounted) return;
      showSnack(context, 'Cálculo eliminado');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final h = widget.item;
    Widget line(String label, String value, {Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            children: [
              Expanded(child: Text(label, style: TextStyle(fontSize: 13, color: c.textDim))),
              Flexible(
                child: Text(value,
                    textAlign: TextAlign.right,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: color)),
              ),
            ],
          ),
        );
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(h.name, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(formatArMoney(h.precioFinal),
                style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 28, color: Brand.gold)),
            const SizedBox(height: 10),
            if (h.customer != null) line('Cliente', h.customer!),
            if (h.materialLabel.isNotEmpty) line('Filamento', h.materialLabel),
            line('Gramos', formatGrams(h.grams)),
            line('Tiempo de impresión', formatDuration(h.hours)),
            line('Fecha', formatDateTime(h.createdAt)),
            if (h.hasCosts) ...[
              Divider(color: c.border, height: 20),
              if (h.costPerKg != null) line('Costo del filamento', '${formatArMoney(h.costPerKg!, decimals: 0)}/kg'),
              line('Costo total de producción', formatArMoney(h.costoTotal!)),
              if (h.marginPct != null) line('Margen', '${formatArNumber(h.marginPct!, maxDecimals: 2)}%'),
              if (h.ganancia != null) line('Ganancia', formatArMoney(h.ganancia!), color: Brand.success),
            ],
            if (h.notes != null) ...[
              Divider(color: c.border, height: 20),
              Text('Observaciones', style: TextStyle(fontSize: 12, color: c.textFaint)),
              const SizedBox(height: 4),
              Text(h.notes!, style: const TextStyle(fontSize: 13.5, height: 1.4)),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              NoticeBanner(_error!, icon: Icons.error_outline_rounded, color: Brand.danger),
            ],
            if (widget.canDelete) ...[
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _deleting ? null : _delete,
                style: OutlinedButton.styleFrom(
                  foregroundColor: Brand.danger,
                  side: const BorderSide(color: Brand.danger),
                ),
                icon: _deleting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Brand.danger))
                    : const Icon(Icons.delete_outline_rounded, size: 18),
                label: const Text('Eliminar del historial'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
