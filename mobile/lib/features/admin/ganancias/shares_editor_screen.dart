import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../analisis/analysis_widgets.dart';
import '../analisis/ar_number.dart';
import '../analisis/charts.dart';
import '../analisis/number_field.dart';
import 'ganancias_api.dart';
import 'ganancias_models.dart';
import 'shares_logic.dart';

class _Row {
  _Row({this.id, String name = '', String role = '', String pct = '0'})
      : name = TextEditingController(text: name),
        role = TextEditingController(text: role),
        pct = TextEditingController(text: pct),
        key = UniqueKey();

  final String? id;
  final Key key;
  final TextEditingController name;
  final TextEditingController role;
  final TextEditingController pct;

  double? get pctValue => parseArNumber(pct.text);
  bool get pctOk => validateArNumber(pct.text, min: 0, max: 100) == null;
  bool get nameOk => name.text.trim().isNotEmpty;

  ShareValues get values => ShareValues(id: id, name: name.text, role: role.text, pct: pctValue);

  void dispose() {
    name.dispose();
    role.dispose();
    pct.dispose();
  }
}

/// Edita el reparto de la ganancia pura entre socios. Todo se guarda junto y el
/// servidor exige que sume 100% (igual que el editor de la web).
class SharesEditorScreen extends ConsumerStatefulWidget {
  const SharesEditorScreen({super.key, required this.overview});

  /// Trae los socios actuales y la ganancia del período (para mostrar cuánto le
  /// toca a cada uno con los porcentajes que se están tipeando).
  final EarningsOverview overview;

  @override
  ConsumerState<SharesEditorScreen> createState() => _SharesEditorScreenState();
}

class _SharesEditorScreenState extends ConsumerState<SharesEditorScreen> {
  late final List<ShareValues> _original = [
    for (final s in widget.overview.shares)
      ShareValues(id: s.id, name: s.name, role: s.role ?? '', pct: s.pct),
  ];
  late final List<_Row> _rows = [
    for (final s in widget.overview.shares)
      _Row(id: s.id, name: s.name, role: s.role ?? '', pct: arEditText(s.pct)),
  ];
  final List<String> _removed = [];
  final List<String> _removedNames = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  double get _total => _rows.fold(0.0, (a, r) => a + (r.pctValue ?? 0));
  bool get _valid => _rows.isNotEmpty && _rows.every((r) => r.nameOk && r.pctOk);
  bool get _dirty =>
      sharesChanged(_original, [for (final r in _rows) r.values], removed: _removed.length);
  bool get _canSave => _dirty && _valid && isBalanced(_total) && !_saving;

  void _touch() => setState(() => _error = null);

  void _add() {
    if (_rows.length >= kMaxShares) return;
    setState(() => _rows.add(_Row()));
  }

  void _remove(_Row r) {
    if (_rows.length <= 1) return;
    setState(() {
      _rows.remove(r);
      if (r.id != null) {
        _removed.add(r.id!);
        _removedNames.add(r.name.text.trim().isEmpty ? 'un socio' : r.name.text.trim());
      }
    });
    // Se libera después del frame: el campo todavía está en pantalla este frame.
    WidgetsBinding.instance.addPostFrameCallback((_) => r.dispose());
  }

  void _equalize() {
    final parts = equalSplit(_rows.length);
    setState(() {
      for (var i = 0; i < _rows.length; i++) {
        _rows[i].pct.text = arEditText(parts[i]);
      }
      _error = null;
    });
  }

  Future<void> _save() async {
    if (!_canSave) return;
    if (_removed.isNotEmpty) {
      final ok = await confirmDialog(
        context,
        title: 'Quitar del reparto',
        message: 'Vas a quitar a ${_removedNames.join(', ')} del reparto. ¿Guardamos igual?',
        confirmLabel: 'Guardar',
        destructive: false,
      );
      if (!ok || !mounted) return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(gananciasApiProvider).saveShares(
            [
              for (final r in _rows)
                ShareDraft(
                  id: r.id,
                  name: r.name.text.trim(),
                  role: r.role.text.trim(),
                  pct: r.pctValue ?? 0,
                ),
            ],
            removedIds: _removed,
          );
      ref.invalidate(gananciasProvider);
      if (!mounted) return;
      showSnack(context, 'Reparto guardado');
      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmLeave() async {
    final leave = await confirmDialog(
      context,
      title: 'Descartar cambios',
      message: 'Tenés cambios sin guardar en el reparto. ¿Salir igual?',
      confirmLabel: 'Descartar',
    );
    if (leave && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final palette = chartPalette();
    final total = _total;
    final balanced = isBalanced(total);
    final profit = widget.overview.totals.profit;
    final period = widget.overview.isAll ? 'acumulada' : (widget.overview.selectedLabel ?? 'del período');

    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Reparto entre socios')),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            AdminCard(
              accent: balanced ? Brand.success : Brand.warning,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          sharesTotalLabel(total),
                          style: TextStyle(
                            fontFamily: 'Orbitron',
                            fontWeight: FontWeight.w800,
                            fontSize: 22,
                            color: balanced ? Brand.success : Brand.warning,
                          ),
                        ),
                      ),
                      Icon(balanced ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                          color: balanced ? Brand.success : Brand.warning),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ShareBar(parts: [
                    for (var i = 0; i < _rows.length; i++) (_rows[i].pctValue ?? 0, palette[i % palette.length]),
                  ]),
                  const SizedBox(height: 10),
                  Text(
                    balanced
                        ? 'Solo se reparte la ganancia pura (no la amortización).'
                        : 'Tiene que sumar 100% para poder guardar (ahora ${formatArNumber(total, maxDecimals: 0)}%). '
                            'Ajustá los porcentajes o usá "Igualar al 100%".',
                    style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < _rows.length; i++) ...[
              _ShareCard(
                key: _rows[i].key,
                row: _rows[i],
                color: palette[i % palette.length],
                profit: profit,
                canRemove: _rows.length > 1 && !_saving,
                onRemove: () => _remove(_rows[i]),
                onChanged: _touch,
              ),
              const SizedBox(height: 10),
            ],
            Wrap(
              spacing: 10,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: _rows.length >= kMaxShares || _saving ? null : _add,
                  icon: const Icon(Icons.person_add_alt_1_rounded, size: 18),
                  label: const Text('Agregar socio'),
                ),
                OutlinedButton.icon(
                  onPressed: _saving ? null : _equalize,
                  icon: const Icon(Icons.balance_rounded, size: 18),
                  label: const Text('Igualar al 100%'),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Los importes de arriba son sobre ${formatPrice(profit)} de ganancia pura $period.',
              style: TextStyle(fontSize: 11.5, color: c.textFaint),
            ),
            if (_rows.any((r) => !r.nameOk)) ...[
              const SizedBox(height: 12),
              const NoticeBanner('Poné un nombre a cada socio para poder guardar.',
                  icon: Icons.edit_note_rounded, color: Brand.warning),
            ],
            if (_error != null) ...[
              const SizedBox(height: 14),
              NoticeBanner(_error!, icon: Icons.error_outline_rounded, color: Brand.danger),
            ],
          ],
        ),
        bottomNavigationBar: SafeArea(
          minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: GoldButton(
            label: 'Guardar reparto',
            icon: Icons.check_rounded,
            loading: _saving,
            onPressed: _canSave ? _save : null,
          ),
        ),
      ),
    );
  }
}

class _ShareCard extends StatelessWidget {
  const _ShareCard({
    super.key,
    required this.row,
    required this.color,
    required this.profit,
    required this.canRemove,
    required this.onRemove,
    required this.onChanged,
  });

  final _Row row;
  final Color color;
  final double profit;
  final bool canRemove;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final amount = shareAmount(profit, row.pctValue ?? 0);
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 6, 14),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: row.name,
                  onChanged: (_) => onChanged(),
                  textCapitalization: TextCapitalization.words,
                  maxLength: 60,
                  decoration: const InputDecoration(labelText: 'Nombre', counterText: ''),
                ),
              ),
              IconButton(
                tooltip: 'Quitar socio',
                onPressed: canRemove ? onRemove : null,
                icon: Icon(Icons.delete_outline_rounded, color: canRemove ? Brand.danger : c.textFaint),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8, top: 10),
            child: TextField(
              controller: row.role,
              onChanged: (_) => onChanged(),
              maxLength: 60,
              decoration: const InputDecoration(labelText: 'Rol (opcional)', counterText: ''),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 8, top: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 130,
                  child: ArNumberField(
                    controller: row.pct,
                    label: 'Porcentaje',
                    suffix: '%',
                    min: 0,
                    max: 100,
                    onChanged: (_) => onChanged(),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('Le toca', style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            formatPrice(amount),
                            style: const TextStyle(
                              fontFamily: 'Orbitron',
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                              color: Brand.success,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
