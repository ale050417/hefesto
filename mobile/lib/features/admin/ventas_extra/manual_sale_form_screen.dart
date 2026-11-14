import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_providers.dart';
import '../admin_widgets.dart';
import '../sale_status.dart';
import 'sale_line_pickers.dart';
import 'ventas_extra_api.dart';
import 'ventas_extra_models.dart';
import 'ventas_extra_widgets.dart';

/// Nueva venta de mostrador: cliente, productos (del catálogo o texto libre),
/// cobro y estado, en una sola pantalla con el total siempre a la vista.
/// Espeja "Cargar venta" del panel web (`createManualSaleAction`); el servidor
/// calcula costos, ganancia y stock, y es quien dice si algo no cierra.
class ManualSaleFormScreen extends ConsumerStatefulWidget {
  const ManualSaleFormScreen({super.key});

  @override
  ConsumerState<ManualSaleFormScreen> createState() => _ManualSaleFormScreenState();
}

class _ManualSaleFormScreenState extends ConsumerState<ManualSaleFormScreen> {
  final _draft = SaleDraft();
  final _customer = TextEditingController();
  final _detail = TextEditingController();
  bool _busy = false;
  bool _saved = false;
  String? _error;

  @override
  void dispose() {
    _customer.dispose();
    _detail.dispose();
    super.dispose();
  }

  // --- Líneas -------------------------------------------------------------

  void _addLine(SaleDraftLine line, String? category) {
    setState(() {
      // Misma elección Y mismo precio que otra línea: se suman las cantidades.
      // Con otro precio (una unidad con descuento) va en su propia línea: al
      // sumarla a la anterior se cobraba al precio viejo sin avisar.
      final i = line.isCatalog
          ? _draft.lines.indexWhere((l) => l.mergeKey == line.mergeKey && l.unitPrice == line.unitPrice)
          : -1;
      if (i >= 0) {
        final cur = _draft.lines[i];
        _draft.lines[i] = cur.copyWith(quantity: cur.quantity + line.quantity);
      } else {
        _draft.lines.add(line);
      }
      if (_draft.category == null && category != null) _draft.category = category;
      _error = null;
    });
  }

  void _updateLine(SaleDraftLine line) {
    final i = _draft.lines.indexWhere((l) => l.uid == line.uid);
    if (i < 0) return;
    setState(() {
      _draft.lines[i] = line;
      _error = null;
    });
  }

  void _removeLine(int uid) => setState(() => _draft.lines.removeWhere((l) => l.uid == uid));

  Future<void> _openCatalog() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => CatalogPickerScreen(onAdd: _addLine)),
    );
    // El aviso "Agregado: …" de la lista no tiene que quedar tapando el botón.
    if (mounted) ScaffoldMessenger.of(context).hideCurrentSnackBar();
  }

  Future<void> _addFree() async {
    final line = await showAppSheet<SaleDraftLine>(
      context,
      builder: (_) => const FreeLineSheet(),
    );
    if (line != null) _addLine(line, null);
  }

  // --- Insumos ------------------------------------------------------------

  void _updateExtra(SaleDraftExtra e) {
    final i = _draft.extras.indexWhere((x) => x.uid == e.uid);
    if (i < 0) return;
    setState(() {
      _draft.extras[i] = e;
      _error = null;
    });
  }

  // --- Fecha, guardar, salir ---------------------------------------------

  Future<void> _pickDate() async {
    final now = DateTime.now();
    // El calendario de la app (mismos límites de siempre: 3 años atrás, hasta mañana).
    final picked = await pickDay(
      context,
      initial: _draft.date,
      first: DateTime(now.year - 3),
      last: DateTime(now.year, now.month, now.day).add(const Duration(days: 1)),
      title: 'Fecha de la venta',
    );
    if (picked != null && mounted) setState(() => _draft.date = picked);
  }

  Future<void> _save() async {
    if (_busy || _draft.problem != null) return;
    final messenger = ScaffoldMessenger.of(context);
    final customer = _draft.customer.trim();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final created = await ref.read(ventasExtraApiProvider).createManualSale(_draft.toJson());
      invalidateSales(ref);
      if (!mounted) return;
      setState(() => _saved = true);
      Navigator.of(context).pop(true);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text('Venta registrada: $customer · ${formatPrice(created.total)}'),
        ));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos registrar la venta. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirmDiscard() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Descartar la venta?'),
        content: const Text('Cargaste datos que todavía no se registraron. Si salís, se pierden.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Seguir cargando')),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Descartar', style: TextStyle(color: Brand.danger)),
          ),
        ],
      ),
    );
    return ok == true;
  }

  // --- UI -----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final form = ref.watch(saleFormDataProvider).value;
    final problem = _draft.problem;
    final bigText = MediaQuery.textScalerOf(context).scale(15) > 16.5;

    return PopScope(
      canPop: _saved || !_draft.isDirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(title: const Text('Nueva venta')),
        body: Column(
          children: [
            Expanded(
              child: ListView(
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                children: [
                  _customerSection(form),
                  const SizedBox(height: 12),
                  _productsSection(),
                  const SizedBox(height: 12),
                  _extrasSection(),
                  const SizedBox(height: 12),
                  _paymentSection(),
                  const SizedBox(height: 12),
                  _detailSection(form),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: c.surface1,
                border: Border(top: BorderSide(color: c.border)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // El error del servidor va junto al botón, donde se mira.
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: InlineError(_error!),
                        )
                      else if (problem != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline_rounded, size: 15, color: c.textFaint),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  problem,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 12, color: c.textDim),
                                ),
                              ),
                            ],
                          ),
                        ),
                      // El total nunca le saca lugar al botón: ocupa como mucho un
                      // tercio del ancho y, si es muy largo (9 cifras), se achica.
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(
                            flex: 34,
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        'TOTAL',
                                        style: TextStyle(
                                          fontFamily: 'Orbitron',
                                          fontSize: 9.5,
                                          letterSpacing: 1.6,
                                          fontWeight: FontWeight.w700,
                                          color: c.textFaint,
                                        ),
                                      ),
                                      if (_draft.units > 0)
                                        Text(
                                          '  ${_draft.units} u.',
                                          style: TextStyle(fontSize: 11, color: c.textFaint),
                                        ),
                                    ],
                                  ),
                                  Text(
                                    formatPrice(_draft.total),
                                    style: const TextStyle(
                                      fontFamily: 'Orbitron',
                                      fontWeight: FontWeight.w800,
                                      fontSize: 21,
                                      color: Brand.gold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            flex: 66,
                            child: GoldButton(
                              label: 'Registrar venta',
                              // Con letra grande el ícono le sacaba lugar al rótulo.
                              icon: bigText ? null : Icons.check_rounded,
                              loading: _busy,
                              onPressed: problem == null ? _save : null,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _customerSection(SaleFormData? form) {
    final c = context.hc;
    final typed = _customer.text.trim().toLowerCase();
    final suggestions = (form?.recentCustomers ?? const <String>[])
        .where((n) => typed.isEmpty ? true : n.toLowerCase().contains(typed))
        .where((n) => n.toLowerCase() != typed)
        .take(5)
        .toList();
    return FormSection(
      title: 'Cliente',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _customer,
            textCapitalization: TextCapitalization.words,
            maxLength: 120,
            onChanged: (v) => setState(() {
              _draft.customer = v;
              _error = null;
            }),
            decoration: const InputDecoration(
              labelText: 'Nombre del cliente',
              prefixIcon: Icon(Icons.person_outline_rounded),
              counterText: '',
            ),
          ),
          if (suggestions.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              typed.isEmpty ? 'Clientes anteriores' : 'Coincidencias',
              style: TextStyle(fontSize: 11.5, color: c.textFaint),
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                for (final n in suggestions)
                  ActionChip(
                    label: Text(n, overflow: TextOverflow.ellipsis),
                    onPressed: () => setState(() {
                      _customer.text = n;
                      _customer.selection = TextSelection.collapsed(offset: n.length);
                      _draft.customer = n;
                    }),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 14),
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: _pickDate,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                color: c.surface2,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: c.border),
              ),
              child: Row(
                children: [
                  Icon(Icons.event_rounded, size: 20, color: c.textDim),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      formatLongDay(_draft.date),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  Icon(Icons.edit_calendar_outlined, size: 18, color: c.textFaint),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _productsSection() {
    final c = context.hc;
    return FormSection(
      title: 'Productos',
      trailing: _draft.lines.isEmpty ? null : MiniTag('${_draft.units} u.'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_draft.lines.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                'Sumá lo que se vendió: elegilo del catálogo (con su precio y su carrete) o cargalo como texto libre.',
                style: TextStyle(fontSize: 13, color: c.textDim, height: 1.4),
              ),
            ),
          for (final l in _draft.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LineCard(
                key: ValueKey(l.uid),
                line: l,
                onChanged: _updateLine,
                onRemove: () => _removeLine(l.uid),
              ),
            ),
          // Con letra grande los dos botones no entran lado a lado: se apilan.
          LayoutBuilder(
            builder: (context, box) {
              final stacked = MediaQuery.textScalerOf(context).scale(14) > 15.4 || box.maxWidth < 280;
              final catalog = OutlinedButton.icon(
                style: _outlined(),
                icon: const Icon(Icons.inventory_2_outlined, size: 18),
                label: const Text('Catálogo'),
                onPressed: _openCatalog,
              );
              final free = OutlinedButton.icon(
                style: _outlined(),
                icon: const Icon(Icons.edit_note_rounded, size: 20),
                label: const Text('Texto libre'),
                onPressed: _addFree,
              );
              return stacked
                  ? Column(children: [catalog, const SizedBox(height: 10), free])
                  : Row(children: [Expanded(child: catalog), const SizedBox(width: 10), Expanded(child: free)]);
            },
          ),
        ],
      ),
    );
  }

  // Solo el tamaño: color, borde y forma los pone el tema.
  ButtonStyle _outlined() => OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(46),
        padding: const EdgeInsets.symmetric(horizontal: 12),
      );

  Widget _extrasSection() {
    final c = context.hc;
    return FormSection(
      title: 'Insumos extra (opcional)',
      trailing: _draft.extrasTotal > 0 ? MiniTag(formatPrice(_draft.extrasTotal)) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Argollas, vaso, etc. Lo que cargues acá se suma al total cobrado y al costo.',
            style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.4),
          ),
          for (final e in _draft.extras)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: _ExtraRow(
                key: ValueKey(e.uid),
                extra: e,
                onChanged: _updateExtra,
                onRemove: () => setState(() => _draft.extras.removeWhere((x) => x.uid == e.uid)),
              ),
            ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Agregar insumo'),
              onPressed: () => setState(() => _draft.extras.add(SaleDraftExtra(uid: nextDraftUid()))),
            ),
          ),
        ],
      ),
    );
  }

  Widget _paymentSection() {
    final c = context.hc;
    final s = _draft.status;
    final hint = switch (s) {
      SaleStatus.pendingPayment =>
        'Queda pendiente: todavía no suma a ganancias y el filamento se descuenta cuando confirmás el pago.',
      SaleStatus.cancelled || SaleStatus.refunded =>
        'Se guarda como ${s.label.toLowerCase()}: no suma a facturación ni descuenta stock.',
      _ => 'Ya cobrada: suma a facturación y ganancias, y descuenta el filamento al registrarla.',
    };
    return FormSection(
      title: 'Cobro',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Medio de pago', style: _labelStyle(c)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in paymentMethodLabels.entries)
                ChoiceChip(
                  label: Text(m.value),
                  selected: _draft.paymentMethod == m.key,
                  onSelected: (_) => setState(() => _draft.paymentMethod = m.key),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Estado de la venta', style: _labelStyle(c)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final st in SaleStatus.values)
                ChoiceChip(
                  avatar: Icon(st.icon, size: 15, color: st.color),
                  label: Text(st.label),
                  selected: s == st,
                  onSelected: (_) => setState(() => _draft.status = st),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(hint, style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.4)),
        ],
      ),
    );
  }

  TextStyle _labelStyle(HefestoColors c) =>
      TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w700);

  Widget _detailSection(SaleFormData? form) {
    final c = context.hc;
    final categories = form?.categories ?? const <String>[];
    return FormSection(
      title: 'Detalle',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _detail,
            maxLines: 2,
            minLines: 1,
            maxLength: 300,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (v) => setState(() => _draft.detail = v),
            decoration: const InputDecoration(
              labelText: 'Nota o detalle (opcional)',
              helperText: 'Si lo dejás vacío se arma con los productos.',
              counterText: '',
            ),
          ),
          if (categories.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Categoría (para los reportes)', style: _labelStyle(c)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Sin categoría'),
                  selected: _draft.category == null,
                  onSelected: (_) => setState(() => _draft.category = null),
                ),
                for (final cat in categories)
                  ChoiceChip(
                    label: Text(cat),
                    selected: _draft.category == cat,
                    onSelected: (_) => setState(() => _draft.category = cat),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Una línea de la venta con su cantidad, precio (y costo si hace falta).
class _LineCard extends StatefulWidget {
  const _LineCard({super.key, required this.line, required this.onChanged, required this.onRemove});
  final SaleDraftLine line;
  final ValueChanged<SaleDraftLine> onChanged;
  final VoidCallback onRemove;

  @override
  State<_LineCard> createState() => _LineCardState();
}

class _LineCardState extends State<_LineCard> {
  late final _price = TextEditingController(text: moneyText(widget.line.unitPrice));
  late final _cost = TextEditingController(text: moneyText(widget.line.unitCost));

  @override
  void dispose() {
    _price.dispose();
    _cost.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final l = widget.line;
    final backToStore = l.catalogPrice != null && l.unitPrice != l.catalogPrice;

    final (IconData badgeIcon, Color badgeColor, String badgeText) = l.isCatalog
        ? (l.hasStock
            ? (Icons.check_circle_outline_rounded, Brand.success, 'Descuenta stock')
            : (Icons.warning_amber_rounded, Brand.warning, 'Sin carrete: cargá el costo'))
        : (Icons.edit_note_rounded, c.textFaint, 'Texto libre · no descuenta stock');

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (l.colorHex != null) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: ColorDot(l.colorHex),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                    ),
                    if (l.subtitle != null)
                      Text(l.subtitle!, style: TextStyle(fontSize: 12.5, color: c.textDim)),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Quitar',
                visualDensity: VisualDensity.compact,
                icon: Icon(Icons.close_rounded, size: 20, color: c.textDim),
                onPressed: widget.onRemove,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: QtyStepper(
                  value: l.quantity,
                  onChanged: (v) => widget.onChanged(l.copyWith(quantity: v)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: MoneyField(
                  controller: _price,
                  label: 'Precio c/u',
                  onChanged: (v) => widget.onChanged(l.copyWith(unitPrice: parseMoney(v))),
                ),
              ),
            ],
          ),
          if (backToStore)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
                onPressed: () {
                  _price.text = moneyText(l.catalogPrice);
                  widget.onChanged(l.copyWith(unitPrice: l.catalogPrice));
                },
                child: Text('Usar el de la tienda (${formatPrice(l.catalogPrice!)})'),
              ),
            ),
          if (l.needsCost) ...[
            const SizedBox(height: 10),
            MoneyField(
              controller: _cost,
              label: 'Costo c/u',
              helperText: 'Lo que te costó. Poné 0 si no tuvo costo.',
              onChanged: (v) => widget.onChanged(l.copyWith(unitCost: parseMoney(v))),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(badgeIcon, size: 15, color: badgeColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  badgeText,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11.5, color: c.textDim),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                formatPrice(l.lineTotal),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Brand.gold),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Un insumo cargado a mano: nombre, costo c/u y cantidad.
class _ExtraRow extends StatefulWidget {
  const _ExtraRow({super.key, required this.extra, required this.onChanged, required this.onRemove});
  final SaleDraftExtra extra;
  final ValueChanged<SaleDraftExtra> onChanged;
  final VoidCallback onRemove;

  @override
  State<_ExtraRow> createState() => _ExtraRowState();
}

class _ExtraRowState extends State<_ExtraRow> {
  late final _name = TextEditingController(text: widget.extra.name);
  late final _cost = TextEditingController(text: moneyText(widget.extra.cost));

  @override
  void dispose() {
    _name.dispose();
    _cost.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final e = widget.extra;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _name,
                  textCapitalization: TextCapitalization.sentences,
                  maxLength: 80,
                  onChanged: (v) => widget.onChanged(e.copyWith(name: v)),
                  decoration: const InputDecoration(labelText: 'Insumo (ej: argollas)', counterText: ''),
                ),
              ),
              IconButton(
                tooltip: 'Quitar insumo',
                visualDensity: VisualDensity.compact,
                icon: Icon(Icons.close_rounded, size: 20, color: c.textDim),
                onPressed: widget.onRemove,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: MoneyField(
                  controller: _cost,
                  label: 'Costo c/u',
                  onChanged: (v) => widget.onChanged(e.copyWith(cost: parseMoney(v))),
                ),
              ),
              const SizedBox(width: 10),
              QtyStepper(
                value: e.qty,
                max: 999,
                onChanged: (v) => widget.onChanged(e.copyWith(qty: v)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
