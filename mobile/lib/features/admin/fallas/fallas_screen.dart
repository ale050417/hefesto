import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../filamentos/filamentos_format.dart';
import '../filamentos/shared_widgets.dart';
import 'falla_form_screen.dart';
import 'fallas_api.dart';
import 'fallas_models.dart';

/// Impresiones fallidas: qué se perdió, cuánto filamento y cuánto costó. Se
/// registran con descuento de stock por carrete (multicolor) y borrar una falla
/// devuelve al stock lo que había descontado. (Se abre desde "Más".)
class AdminFallasScreen extends ConsumerWidget {
  const AdminFallasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('fallas', 'crear') ?? false;
    final data = ref.watch(fallasProvider);

    return AdminModuleScaffold(
      title: 'Impresiones fallidas',
      permission: 'fallas',
      actions: [
        IconButton(
          tooltip: 'Actualizar',
          icon: const Icon(Icons.refresh_rounded),
          onPressed: () => ref.invalidate(fallasProvider),
        ),
      ],
      floatingActionButton: canCreate && data.hasValue
          ? FloatingActionButton.extended(
              heroTag: 'nueva-falla',
              onPressed: () => _register(context, data.value!),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Registrar'),
            )
          : null,
      body: data.when(
        loading: () => const ListSkeleton(rows: 5, height: 92),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(fallasProvider)),
        data: (d) => _FallasBody(data: d),
      ),
    );
  }
}

/// Abre el alta; al volver avisa qué pasó con el stock.
Future<void> _register(BuildContext context, FallasData data) async {
  final res = await Navigator.of(context).push<FallaResult>(
    MaterialPageRoute(builder: (_) => FallaFormScreen(data: data)),
  );
  if (res == null || !context.mounted) return;
  showToast(
    context,
    !res.deducted
        ? 'Falla registrada, pero no se descontó stock (no encontramos los carretes).'
        : res.lowStock
            ? 'Falla registrada · quedó stock bajo, conviene reponer.'
            : 'Falla registrada · stock descontado.',
  );
}

class _FallasBody extends ConsumerStatefulWidget {
  const _FallasBody({required this.data});
  final FallasData data;

  @override
  ConsumerState<_FallasBody> createState() => _FallasBodyState();
}

class _FallasBodyState extends ConsumerState<_FallasBody> {
  final _search = TextEditingController();
  String? _reason;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(fallasProvider);
    try {
      await ref.read(fallasProvider.future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final d = widget.data;
    final q = _search.text.trim().toLowerCase();

    // Causas que realmente aparecen, con cuántas fallas tiene cada una.
    final counts = <String, int>{};
    for (final f in d.items) {
      counts[f.reason] = (counts[f.reason] ?? 0) + 1;
    }
    final reasonList = counts.keys.toList()..sort((a, b) => counts[b]!.compareTo(counts[a]!));
    final activeReason = (_reason != null && counts.containsKey(_reason)) ? _reason : null;

    final items = d.items.where((f) {
      if (activeReason != null && f.reason != activeReason) return false;
      if (q.isEmpty) return true;
      return '${f.pieceName} ${f.reason} ${f.material} ${f.color} ${f.notes ?? ''}'.toLowerCase().contains(q);
    }).toList();

    final s = d.summary;
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
        children: [
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: KpiTile(
                    icon: Icons.report_gmailerrorred_rounded,
                    label: 'Fallas',
                    value: '${s.count}',
                    color: Brand.danger,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: KpiTile(
                    icon: Icons.scale_rounded,
                    label: 'Filamento perdido',
                    value: formatGrams(s.totalGrams),
                    color: Brand.gold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: KpiTile(
                    icon: Icons.attach_money_rounded,
                    label: 'Costo perdido',
                    value: formatPrice(s.totalCost),
                    hint: 'estimado',
                    color: Brand.danger,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: KpiTile(
                    icon: Icons.build_circle_outlined,
                    label: 'Causa más común',
                    value: s.topReason ?? '—',
                    hint: s.topReasonCount > 0
                        ? (s.topReasonCount == 1 ? '1 vez' : '${s.topReasonCount} veces')
                        : null,
                    color: Brand.info,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (d.items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: EmptyView(
                icon: Icons.check_circle_outline_rounded,
                title: 'Sin fallas registradas',
                subtitle: '¡Buen trabajo! Cuando se pierda una impresión, registrala acá para '
                    'descontar el filamento y llevar la cuenta.',
              ),
            )
          else ...[
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Buscar pieza, causa o color…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => setState(_search.clear),
                      ),
              ),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    label: Text('Todas (${d.items.length})'),
                    selected: activeReason == null,
                    onSelected: (_) => setState(() => _reason = null),
                  ),
                  for (final r in reasonList) ...[
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: Text('$r (${counts[r]})'),
                      selected: activeReason == r,
                      onSelected: (_) => setState(() => _reason = r),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (items.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 24),
                child: Text(
                  'Ninguna falla coincide con la búsqueda.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.textDim),
                ),
              )
            else
              for (final f in items) ...[
                _FallaTile(f, onTap: () => _openSheet(f)),
                const SizedBox(height: 10),
              ],
          ],
        ],
      ),
    );
  }

  Future<void> _openSheet(Falla f) =>
      showAppSheet<void>(context, builder: (_) => _FallaSheet(falla: f, data: widget.data));
}

class _FallaTile extends StatelessWidget {
  const _FallaTile(this.f, {required this.onTap});
  final Falla f;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: ColorDot(hex: f.hex, size: 34),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  f.pieceName.isEmpty ? 'Sin nombre' : f.pieceName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
                if (f.filamentLabel.isNotEmpty)
                  Text(
                    f.filamentLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: c.textDim),
                  ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                      decoration: BoxDecoration(
                        color: Brand.danger.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Text(
                        f.reason,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Brand.danger,
                        ),
                      ),
                    ),
                    if (f.createdAt != null)
                      Text(formatDay(f.createdAt!), style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatGrams(f.gramsLost),
                style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 13.5),
              ),
              const SizedBox(height: 2),
              Text(
                formatPrice(f.cost),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Brand.danger),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Detalle de una falla con las acciones de editar y eliminar.
class _FallaSheet extends ConsumerStatefulWidget {
  const _FallaSheet({required this.falla, required this.data});
  final Falla falla;
  final FallasData data;

  @override
  ConsumerState<_FallaSheet> createState() => _FallaSheetState();
}

class _FallaSheetState extends ConsumerState<_FallaSheet> {
  bool _deleting = false;
  String? _error;

  Future<void> _edit() async {
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    nav.pop(); // cierra la hoja
    final saved = await nav.push<bool>(
      MaterialPageRoute(builder: (_) => FallaFormScreen(data: widget.data, falla: widget.falla)),
    );
    if (saved == true) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('Falla actualizada')));
    }
  }

  Future<void> _delete() async {
    if (_deleting) return;
    final f = widget.falla;
    final msg = f.deducted
        ? 'Se devuelven ${formatGrams(f.gramsLost)} de ${f.filamentLabel.isEmpty ? 'filamento' : f.filamentLabel} al stock.'
        : 'Esta falla no descontó stock, así que no se devuelve nada.';
    final ok = await confirmDialog(
      context,
      title: '¿Eliminar la falla de ${f.pieceName.isEmpty ? 'esta pieza' : f.pieceName}?',
      message: msg,
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final container = ProviderScope.containerOf(context, listen: false);
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      final restored = await ref.read(fallasApiProvider).delete(f.id);
      invalidateFallas(container);
      if (mounted) popIfCurrent(context);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text(restored > 0
              ? 'Falla eliminada · ${formatGrams(restored)} devueltos al stock'
              : 'Falla eliminada'),
        ));
    } on ApiException catch (e) {
      // En la hoja, no en un aviso: el aviso salía DETRÁS de la hoja abierta y
      // no se veía (parecía que el botón no hacía nada).
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos eliminar la falla. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('fallas', 'editar') ?? false;
    final canDelete = me?.can('fallas', 'eliminar') ?? false;
    final f = widget.falla;

    Widget row(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 104, child: Text(k, style: TextStyle(color: c.textDim, fontSize: 13))),
              // Separación fija: "Costo estimado" quedaba pegado al valor.
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  v,
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5, color: c.text),
                ),
              ),
            ],
          ),
        );

    // Hoja estándar: el detalle se desplaza si no entra (notas largas, letra
    // grande) y las acciones quedan fijas arriba de la barra del sistema.
    return SheetBody(
      footer: (canEdit || canDelete)
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_error != null) ...[
                  InlineError(_error!),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    if (canEdit)
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: const Text('Editar'),
                          style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                          onPressed: _deleting ? null : _edit,
                        ),
                      ),
                    if (canEdit && canDelete) const SizedBox(width: 10),
                    if (canDelete)
                      Expanded(
                        child: TextButton.icon(
                          icon: _deleting
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: AppSpinner(color: Brand.danger),
                                )
                              : const Icon(Icons.delete_outline_rounded, size: 18),
                          label: const Text('Eliminar'),
                          style: TextButton.styleFrom(
                            foregroundColor: Brand.danger,
                            minimumSize: const Size.fromHeight(48),
                          ),
                          onPressed: _deleting ? null : _delete,
                        ),
                      ),
                  ],
                ),
              ],
            )
          : null,
      children: [
        Row(
          children: [
            ColorDot(hex: f.hex, size: 30),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                f.pieceName.isEmpty ? 'Sin nombre' : f.pieceName,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (f.createdAt != null) row('Fecha', formatDateTime(f.createdAt!)),
        if (f.filamentLabel.isNotEmpty) row('Filamento', f.filamentLabel),
        row('Perdido', formatGrams(f.gramsLost)),
        row('Costo estimado', formatPrice(f.cost)),
        row('Causa', f.reason),
        row('Stock', f.deducted ? 'Se descontó del carrete' : 'No se descontó'),
        if (f.notes != null) row('Notas', f.notes!),
      ],
    );
  }
}
