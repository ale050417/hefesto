import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../stock_screen.dart' show hexColor;
import 'filament_type_picker.dart';
import 'filamento_form_screen.dart';
import 'filamentos_api.dart';
import 'filamentos_format.dart';
import 'filamentos_models.dart';
import 'movement_tile.dart';
import 'shared_widgets.dart';
import 'stock_adjust_sheet.dart';
import 'weigh_sheet.dart';

/// Detalle de un carrete: stock, costo (con su tipo), acciones (ajustar, calcular
/// pesando el carrete, sumar carrete, editar, eliminar) e historial de movimientos.
class FilamentoDetailScreen extends ConsumerWidget {
  const FilamentoDetailScreen({super.key, required this.id});
  final String id;

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(filamentoProvider(id));
    ref.invalidate(filamentMovementsProvider(id));
    try {
      await ref.read(filamentoProvider(id).future);
    } catch (_) {}
  }

  Future<void> _adjust(BuildContext context, WidgetRef ref, Filamento f) async {
    final res = await showStockAdjustSheet(context, f);
    if (res != null && context.mounted) _toastResult(context, res);
  }

  /// "Calcular filamento": pesar el carrete en uso y restar el carrete vacío.
  Future<void> _weigh(BuildContext context, Filamento f) async {
    final res = await showWeighSheet(context, f);
    if (res != null && context.mounted) showToast(context, weighResultText(res));
  }

  void _toastResult(BuildContext context, StockAdjustResult res) {
    showToast(
      context,
      'Stock: ${formatGrams(res.previousStock)} → ${formatGrams(res.newStock)}'
      '${res.lowStock ? ' · quedó bajo el umbral, conviene reponer' : ''}',
    );
  }

  /// "+1 carrete": suma el tamaño del carrete con un toque (con confirmación).
  Future<void> _addSpool(BuildContext context, WidgetRef ref, Filamento f) async {
    if (f.spoolGrams <= 0) return;
    // Un carrete que debe MÁS que un carrete entero seguiría en negativo y el
    // servidor rechaza ese ajuste (con un mensaje que confunde: "No hay stock
    // para restar."): se explica acá qué hacer.
    if (f.stockGrams + f.spoolGrams < 0) {
      showToast(
        context,
        'Este carrete debe ${formatGrams(f.debtGrams)}: usá «Ajustar stock» y sumá al menos eso.',
      );
      return;
    }
    final ok = await confirmDialog(
      context,
      title: 'Sumar un carrete',
      message: 'Se suman ${formatGrams(f.spoolGrams)} al stock de ${f.tag}.',
      confirmLabel: 'Sumar',
    );
    if (!ok || !context.mounted) return;
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      final res = await ref.read(filamentosApiProvider).adjust(
            f.id,
            deltaGrams: f.spoolGrams,
            reason: 'Carrete sumado',
          );
      invalidateFilamentos(container);
      if (context.mounted) _toastResult(context, res);
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message);
    }
  }

  Future<void> _edit(BuildContext context, Filamento f) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => FilamentoFormScreen(filament: f)),
    );
    if (saved == true && context.mounted) showToast(context, 'Filamento actualizado');
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, Filamento f) async {
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar ${f.material} ${f.color}?',
      message: 'Se borra el carrete (${formatGrams(f.stockGrams < 0 ? 0 : f.stockGrams)} en stock). '
          'El historial y las fallas ya registradas se conservan. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !context.mounted) return;
    final container = ProviderScope.containerOf(context, listen: false);
    try {
      await ref.read(filamentosApiProvider).delete(f.id);
      invalidateFilamentos(container);
      if (context.mounted) {
        showToast(context, 'Filamento eliminado');
        popIfCurrent(context);
      }
    } on ApiException catch (e) {
      if (context.mounted) showToast(context, e.message);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('filamentos', 'editar') ?? false;
    final canDelete = me?.can('filamentos', 'eliminar') ?? false;
    final fil = ref.watch(filamentoProvider(id));
    final movs = ref.watch(filamentMovementsProvider(id));
    // Solo para mostrar el nombre del tipo: si no llega, se ve el costo solo.
    final types = ref.watch(filamentTypesProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Filamento'),
        actions: [
          if (fil.value != null && canEdit)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_outlined),
              onPressed: () => _edit(context, fil.value!),
            ),
          if (fil.value != null && canDelete)
            IconButton(
              tooltip: 'Eliminar',
              icon: const Icon(Icons.delete_outline_rounded, color: Brand.danger),
              onPressed: () => _delete(context, ref, fil.value!),
            ),
        ],
      ),
      // La app dibuja de borde a borde: sin `SafeArea` el último movimiento
      // quedaba debajo de la barra de gestos / de los tres botones del sistema.
      body: SafeArea(
        top: false,
        child: fil.when(
        loading: () => const ListSkeleton(rows: 3, height: 140),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => _refresh(ref)),
        data: (f) => RefreshIndicator(
          color: Brand.gold,
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              _StockCard(f),
              const SizedBox(height: 12),
              if (canEdit) ...[
                _ActionsCard(
                  f: f,
                  onSpool: () => _addSpool(context, ref, f),
                  onAdjust: () => _adjust(context, ref, f),
                  onWeigh: () => _weigh(context, f),
                ),
                const SizedBox(height: 12),
              ],
              _InfoCard(f, typeName: types?.typeOf(f.typeId)?.name),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => openFilamentTypes(context),
                  icon: const Icon(Icons.sell_outlined, size: 18),
                  label: const Text('Tipos y precios'),
                ),
              ),
              const AdminSectionTitle('Movimientos'),
              movs.when(
                loading: () => const Skeleton(height: 90, radius: 20),
                error: (e, _) => AdminCard(
                  child: Row(
                    children: [
                      Expanded(child: Text('$e', style: TextStyle(color: context.hc.textDim))),
                      TextButton(
                        onPressed: () => ref.invalidate(filamentMovementsProvider(id)),
                        child: const Text('Reintentar'),
                      ),
                    ],
                  ),
                ),
                data: (list) => list.isEmpty
                    ? AdminCard(
                        child: Text(
                          'Todavía no hay movimientos de este carrete. Aparecen las ventas, '
                          'las fallas y los ajustes de stock.',
                          style: TextStyle(color: context.hc.textDim, fontSize: 13),
                        ),
                      )
                    : AdminCard(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        child: Column(
                          children: [
                            for (var i = 0; i < list.length; i++) ...[
                              if (i > 0) Divider(height: 1, color: context.hc.border),
                              MovementTile(list[i], showFilament: false),
                            ],
                          ],
                        ),
                      ),
              ),
            ],
          ),
        ),
        ),
      ),
    );
  }
}

class _StockCard extends StatelessWidget {
  const _StockCard(this.f);
  final Filamento f;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final statusColor = f.isOut ? Brand.danger : (f.isLow ? Brand.warning : Brand.success);
    final statusText = f.isOut ? 'Agotado' : (f.isLow ? 'Stock bajo' : 'En stock');
    final full = f.spoolGrams > 0 ? f.spoolGrams : 1000.0;
    final shown = f.stockGrams < 0 ? 0.0 : f.stockGrams;
    final progress = (shown / full).clamp(0.0, 1.0);
    final mark = (f.alertThresholdGrams / full).clamp(0.0, 1.0);
    final spools = f.spoolGrams > 0 ? shown / f.spoolGrams : 0.0;

    return AdminCard(
      accent: statusColor,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: hexColor(f.hex),
                  border: Border.all(color: c.border, width: 1.5),
                ),
                child: Center(
                  child: Container(
                    width: 17,
                    height: 17,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: c.bg),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${f.material} · ${f.color}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      [f.brand, if (f.diameter.isNotEmpty) '${f.diameter} mm']
                          .where((e) => e.isNotEmpty)
                          .join(' · '),
                      style: TextStyle(fontSize: 12.5, color: c.textDim),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    formatGrams(shown),
                    style: TextStyle(
                      fontFamily: 'Orbitron',
                      fontWeight: FontWeight.w800,
                      fontSize: 32,
                      color: statusColor,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  statusText,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: statusColor),
                ),
              ),
            ],
          ),
          if (f.debtGrams > 0) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Brand.danger.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Debés ${formatGrams(f.debtGrams)}: se vendió más de lo cargado y se '
                'descuenta al reponer este color.',
                style: const TextStyle(fontSize: 12.5, color: Brand.danger, fontWeight: FontWeight.w600),
              ),
            ),
          ],
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (_, box) => Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    backgroundColor: c.surface3,
                    valueColor: AlwaysStoppedAnimation(statusColor),
                  ),
                ),
                Positioned(
                  left: (box.maxWidth * mark).clamp(0.0, box.maxWidth - 2),
                  top: -2,
                  child: Container(width: 2, height: 12, color: c.textFaint),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Alerta en ${formatGrams(f.alertThresholdGrams)}',
                  style: TextStyle(fontSize: 11.5, color: c.textFaint),
                ),
              ),
              Text(
                '~${spools.toStringAsFixed(1).replaceAll('.', ',')} carrete(s) de ${formatGrams(f.spoolGrams)}',
                style: TextStyle(fontSize: 11.5, color: c.textFaint),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionsCard extends StatelessWidget {
  const _ActionsCard({
    required this.f,
    required this.onSpool,
    required this.onAdjust,
    required this.onWeigh,
  });
  final Filamento f;
  final VoidCallback onSpool;
  final VoidCallback onAdjust;
  final VoidCallback onWeigh;

  @override
  Widget build(BuildContext context) {
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Stock'),
          const SizedBox(height: 12),
          GoldButton(
            label: 'Ajustar stock',
            icon: Icons.tune_rounded,
            onPressed: onAdjust,
          ),
          const SizedBox(height: 10),
          // Pesar el carrete en uso: peso total − carrete vacío (pedido de
          // Agustín, 2026-11-24).
          OutlinedButton.icon(
            icon: const Icon(Icons.scale_outlined, size: 18),
            label: const Text('Calcular filamento', maxLines: 1, overflow: TextOverflow.ellipsis),
            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
            onPressed: onWeigh,
          ),
          if (f.spoolGrams > 0) ...[
            const SizedBox(height: 10),
            // Colores y forma: los del tema (contorno dorado = acción secundaria).
            OutlinedButton.icon(
              icon: const Icon(Icons.add_rounded, size: 18),
              label: Text(
                'Sumar 1 carrete (${formatGrams(f.spoolGrams)})',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: onSpool,
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard(this.f, {this.typeName});
  final Filamento f;

  /// Nombre del tipo del que sale el precio (null = sin tipo o no cargó).
  final String? typeName;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          // El valor ocupa todo el resto de la fila y va pegado al borde
          // derecho (antes quedaba flotando en el medio de la tarjeta).
          child: Row(
            children: [
              Text(k, style: TextStyle(color: c.textDim, fontSize: 13)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  v,
                  textAlign: TextAlign.right,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                ),
              ),
            ],
          ),
        );
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Column(
        children: [
          row('Costo por kg', typeName == null ? formatPrice(f.costPerKg) : '${formatPrice(f.costPerKg)} · $typeName'),
          Divider(height: 1, color: c.border),
          row('Valor en stock', formatPrice(f.stockValue)),
          Divider(height: 1, color: c.border),
          row('Tamaño del carrete', formatGrams(f.spoolGrams)),
          Divider(height: 1, color: c.border),
          row('Alerta de stock bajo', formatGrams(f.alertThresholdGrams)),
        ],
      ),
    );
  }
}
