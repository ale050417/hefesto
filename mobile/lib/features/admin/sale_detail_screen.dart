import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/modals.dart';
import 'admin_models.dart';
import 'admin_providers.dart';
import 'admin_widgets.dart';
import 'sale_status.dart';
import 'ventas_extra/sale_extra_menu.dart';
import 'ventas_extra/ventas_extra_widgets.dart';

/// "+54 3757 62-4148" → "543757624148" para wa.me.
String _waNumber(String phone) {
  var d = phone.replaceAll(RegExp(r'\D'), '');
  if (d.startsWith('00')) d = d.substring(2);
  if (d.startsWith('54')) return d;
  if (d.startsWith('0')) d = d.substring(1);
  return '549$d';
}

/// Rótulo de botón que nunca se parte en dos renglones: si no entra (botones
/// lado a lado en un teléfono chico, letra grande) se achica.
Widget _oneLine(String text, {TextStyle? style}) => FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(text, maxLines: 1, softWrap: false, style: style),
    );

void _toast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Detalle de un pedido online o de una venta de mostrador, con acciones.
class SaleDetailScreen extends ConsumerWidget {
  const SaleDetailScreen({super.key, required this.source, required this.id});
  final String source;
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (source: source, id: id);
    final sale = ref.watch(adminSaleProvider(key));
    final me = ref.watch(meProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle'),
        actions: [
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(adminSaleProvider(key)),
          ),
          // Editar (mostrador) · comprobante · eliminar (solo admin).
          if (sale.value != null) SaleExtraMenu(d: sale.value!),
        ],
      ),
      body: sale.when(
        loading: () => const ListSkeleton(rows: 4, height: 130),
        error: (e, _) => ErrorView(
          message: '$e',
          onRetry: () => ref.invalidate(adminSaleProvider(key)),
        ),
        data: (d) => RefreshIndicator(
          color: Brand.gold,
          onRefresh: () async {
            ref.invalidate(adminSaleProvider(key));
            try {
              await ref.read(adminSaleProvider(key).future);
            } catch (_) {}
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              _HeaderCard(d),
              const SizedBox(height: 12),
              _ActionsCard(d, me),
              const SizedBox(height: 12),
              _CustomerCard(d),
              const SizedBox(height: 12),
              _ItemsCard(d),
              if (!d.isManual) ...[
                const SizedBox(height: 12),
                _MetaCard(
                  key: ValueKey('${d.trackingCode}|${d.internalNote}'),
                  d: d,
                  canEdit: me?.can('pedidos', 'editar') ?? false,
                ),
              ],
              if (d.history.isNotEmpty) ...[
                const SizedBox(height: 12),
                _HistoryCard(d),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard(this.d);
  final SaleDetail d;

  @override
  Widget build(BuildContext context) {
    return AdminCard(
      accent: d.status.color,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Si el número y el estado no entran lado a lado (teléfono chico,
          // letra grande, "Venta manual"), el estado baja de renglón: antes el
          // número quedaba partido ("HF-0 / 042").
          SizedBox(
            width: double.infinity,
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 10,
              runSpacing: 8,
              children: [
                GestureDetector(
                  onLongPress: () {
                    Clipboard.setData(ClipboardData(text: d.title));
                    _toast(context, 'Copiado: ${d.title}');
                  },
                  child: Text(
                    d.title,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                StatusChip(d.status, large: true),
              ],
            ),
          ),
          const SizedBox(height: 14),
          // Un total de 9 cifras se achica en vez de partirse en dos renglones.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              formatPrice(d.total),
              maxLines: 1,
              style: const TextStyle(
                fontFamily: 'Orbitron',
                fontWeight: FontWeight.w800,
                fontSize: 34,
                color: Brand.gold,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              MiniTag(formatDateTime(d.date), icon: Icons.event_rounded),
              MiniTag(paymentLabel(d.paymentMethod), icon: Icons.account_balance_wallet_outlined),
              MiniTag(
                d.isManual ? 'Mostrador' : 'Tienda online',
                icon: d.isManual ? Icons.point_of_sale_rounded : Icons.shopping_bag_outlined,
              ),
              if (d.paidAt != null)
                MiniTag('Pagado ${formatDay(d.paidAt!)}', icon: Icons.check_rounded),
            ],
          ),
          if (d.status.isFinal) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: d.status.color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                d.cancelReason == null
                    ? '${d.status.label}. No admite más cambios.'
                    : '${d.status.label}: ${d.cancelReason}',
                style: TextStyle(fontSize: 13, color: d.status.color, fontWeight: FontWeight.w600),
              ),
            ),
          ] else ...[
            const SizedBox(height: 16),
            _FlowProgress(d.status),
          ],
        ],
      ),
    );
  }
}

/// Camino del pedido: pendiente → confirmado → producción → listo → enviado → entregado.
class _FlowProgress extends StatelessWidget {
  const _FlowProgress(this.status);
  final SaleStatus status;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final idx = SaleStatus.flow.indexOf(status);
    return Column(
      children: [
        Row(
          children: [
            for (var i = 0; i < SaleStatus.flow.length; i++) ...[
              _Dot(
                state: i < idx ? 2 : (i == idx ? 1 : 0),
                icon: SaleStatus.flow[i].icon,
                color: SaleStatus.flow[i].color,
              ),
              if (i < SaleStatus.flow.length - 1)
                Expanded(
                  child: Container(
                    height: 3,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i < idx ? Brand.gold : c.surface3,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Text(
            idx == SaleStatus.flow.length - 1
                ? 'Pedido completo'
                : 'Siguiente: ${SaleStatus.flow[idx + 1].label}',
            style: TextStyle(fontSize: 12, color: c.textDim),
          ),
        ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.state, required this.icon, required this.color});

  /// 0 = pendiente · 1 = actual · 2 = hecho
  final int state;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final done = state == 2;
    final current = state == 1;
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? Brand.gold : (current ? color.withValues(alpha: 0.18) : c.surface2),
        border: Border.all(
          color: current ? color : (done ? Brand.gold : c.border),
          width: current ? 2 : 1,
        ),
      ),
      child: Icon(
        done ? Icons.check_rounded : icon,
        size: 15,
        color: done ? Brand.goldFg : (current ? color : c.textFaint),
      ),
    );
  }
}

class _ActionsCard extends ConsumerWidget {
  const _ActionsCard(this.d, this.me);
  final SaleDetail d;
  final MeInfo? me;

  Future<void> _go(BuildContext context, WidgetRef ref, SaleStatus target) async {
    final ok = await showAppSheet<bool>(
      context,
      builder: (_) => _StatusSheet(d: d, target: target),
    );
    if (ok == true && context.mounted) {
      _toast(context, '${d.title}: ${target.label}');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    if (d.status.isFinal) return const SizedBox.shrink();

    final canEdit = me?.can('pedidos', 'editar') ?? false;
    if (!canEdit) {
      return AdminCard(
        child: Row(
          children: [
            Icon(Icons.visibility_outlined, color: c.textDim),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Tu cuenta puede ver los pedidos pero no modificarlos.',
                style: TextStyle(color: c.textDim, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final options = d.status.next
        .where((s) => !s.isDestructive || (me?.isAdmin ?? false))
        .toList();
    final forward = options.where((s) => !s.isDestructive).toList();
    final danger = options.where((s) => s.isDestructive).toList();

    return AdminCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ACCIONES',
            style: TextStyle(
              fontFamily: 'Orbitron',
              fontSize: 10.5,
              letterSpacing: 2,
              fontWeight: FontWeight.w700,
              color: c.textFaint,
            ),
          ),
          const SizedBox(height: 12),
          if (forward.isNotEmpty)
            GoldButton(
              label: forward.first.actionLabel,
              icon: forward.first.icon,
              onPressed: () => _go(context, ref, forward.first),
            ),
          for (final s in forward.skip(1)) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: OutlinedButton.icon(
                icon: Icon(s.icon, size: 18, color: s.color),
                label: _oneLine(s.actionLabel),
                onPressed: () => _go(context, ref, s),
              ),
            ),
          ],
          if (danger.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                for (final s in danger)
                  Expanded(
                    child: TextButton.icon(
                      icon: Icon(s.icon, size: 17, color: Brand.danger),
                      label: _oneLine(
                        s.actionLabel,
                        style: const TextStyle(color: Brand.danger, fontWeight: FontWeight.w700),
                      ),
                      onPressed: () => _go(context, ref, s),
                    ),
                  ),
              ],
            ),
          ],
          if (me?.isAdmin != true && d.status.next.any((s) => s.isDestructive))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Cancelar o reembolsar es solo para administradores.',
                style: TextStyle(fontSize: 11.5, color: c.textFaint),
              ),
            ),
        ],
      ),
    );
  }
}

/// Hoja de confirmación: nota, motivo (cancelar/reembolsar) y código de
/// seguimiento (enviar). Hace el cambio ella misma y se cierra al terminar.
class _StatusSheet extends ConsumerStatefulWidget {
  const _StatusSheet({required this.d, required this.target});
  final SaleDetail d;
  final SaleStatus target;

  @override
  ConsumerState<_StatusSheet> createState() => _StatusSheetState();
}

class _StatusSheetState extends ConsumerState<_StatusSheet> {
  final _note = TextEditingController();
  final _tracking = TextEditingController();
  bool _loading = false;
  String? _error;

  bool get _needsTracking =>
      widget.target == SaleStatus.shipped && !widget.d.isManual && widget.d.trackingCode == null;

  String get _hint {
    final manual = widget.d.isManual;
    return switch (widget.target) {
      SaleStatus.confirmed => 'Se marca el pago como acreditado y se descuenta el '
          'filamento del stock.${manual ? '' : ' Le avisamos al cliente.'}',
      SaleStatus.cancelled || SaleStatus.refunded => 'Se repone el filamento que se había '
          'descontado. Esto no se puede deshacer.',
      SaleStatus.shipped when _needsTracking =>
        'Cargá el código de seguimiento del envío (es obligatorio). Le avisamos al cliente por mail y notificación.',
      _ => manual ? 'Actualiza el estado de la venta.' : 'Le avisamos al cliente por mail y notificación.',
    };
  }

  @override
  void dispose() {
    _note.dispose();
    _tracking.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Dos toques seguidos no mandan el cambio dos veces.
    if (_loading) return;
    if (_needsTracking && _tracking.text.trim().isEmpty) {
      setState(() => _error = 'Cargá el código de seguimiento para marcarlo como enviado.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      if (_needsTracking) {
        await api.adminOrderMeta(widget.d.id, trackingCode: _tracking.text.trim());
        // El código ya quedó guardado aunque el cambio de estado falle después:
        // el detalle de atrás lo tiene que mostrar.
        invalidateSales(ref);
      }
      await api.adminSetStatus(widget.d.source, widget.d.id, widget.target, note: _note.text);
      invalidateSales(ref);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'No pudimos completar el cambio. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final t = widget.target;
    final destructive = t.isDestructive;
    // Hoja estándar (2026-11-14, pedido de Ale: "que cuando tocás los botones
    // se vean bien los modales"): el contenido se desplaza si no entra y los
    // botones quedan fijos, arriba del teclado y de la barra del sistema.
    return SheetBody(
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // El error va fijo junto a los botones, donde se mira: dentro del
          // contenido podía quedar fuera de la vista en un teléfono chico.
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: _loading ? null : () => Navigator.of(context).pop(false),
                  child: const Text('Volver'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: destructive
                    ? FilledButton(
                        // Rojo: es una acción que no se deshace.
                        style: FilledButton.styleFrom(
                          backgroundColor: Brand.danger,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(50),
                        ),
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: AppSpinner(color: Colors.white),
                              )
                            : Text('Sí, ${t.actionLabel.toLowerCase()}'),
                      )
                    : GoldButton(
                        label: 'Confirmar',
                        loading: _loading,
                        onPressed: _submit,
                      ),
              ),
            ],
          ),
        ],
      ),
      children: [
        Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: t.color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(t.icon, color: t.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.actionLabel, style: Theme.of(context).textTheme.titleLarge),
                  Text(
                    '${widget.d.title}${widget.d.customerName == null ? '' : ' · ${widget.d.customerName}'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textDim, fontSize: 13),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(_hint, style: TextStyle(color: c.textDim, fontSize: 13, height: 1.4)),
        if (_needsTracking) ...[
          const SizedBox(height: 14),
          TextField(
            controller: _tracking,
            textCapitalization: TextCapitalization.characters,
            // El servidor acepta hasta 120 caracteres.
            maxLength: 120,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
            decoration: const InputDecoration(
              counterText: '',
              hintText: 'Código de seguimiento',
              prefixIcon: Icon(Icons.local_shipping_outlined),
            ),
          ),
        ],
        if (destructive) ...[
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final r in cancelReasons)
                ActionChip(
                  label: Text(r, style: const TextStyle(fontSize: 12)),
                  onPressed: () => setState(() => _note.text = r),
                ),
            ],
          ),
        ],
        const SizedBox(height: 14),
        TextField(
          controller: _note,
          maxLength: 300,
          maxLines: 2,
          textCapitalization: TextCapitalization.sentences,
          decoration: InputDecoration(
            counterText: '',
            hintText: destructive ? 'Motivo (opcional)' : 'Nota (opcional)',
            prefixIcon: const Icon(Icons.notes_rounded),
          ),
        ),
      ],
    );
  }
}

class _CardTitle extends StatelessWidget {
  const _CardTitle(this.text, {this.trailing});
  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                text.toUpperCase(),
                style: TextStyle(
                  fontFamily: 'Orbitron',
                  fontSize: 10.5,
                  letterSpacing: 2,
                  fontWeight: FontWeight.w700,
                  color: context.hc.textFaint,
                ),
              ),
            ),
            ?trailing,
          ],
        ),
      );
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard(this.d);
  final SaleDetail d;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final name = d.customerName ?? 'Cliente sin nombre';
    final phone = d.customerPhone;
    final address = d.addressText;
    final delivery = SaleDetail.deliveryLabel(d.address);
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Cliente'),
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: const BoxDecoration(gradient: Brand.goldGradient, shape: BoxShape.circle),
                child: Text(
                  name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase(),
                  style: const TextStyle(
                    fontFamily: 'Orbitron',
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    color: Brand.goldFg,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    if (phone != null)
                      Text(phone, style: TextStyle(color: c.textDim, fontSize: 13)),
                  ],
                ),
              ),
            ],
          ),
          if (phone != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    // Verde de WhatsApp (el resto lo pone el tema).
                    style: FilledButton.styleFrom(
                      backgroundColor: Brand.whatsapp,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(44),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    icon: const Icon(Icons.chat_rounded, size: 18),
                    label: _oneLine('WhatsApp'),
                    onPressed: () => openWhatsapp(
                      _waNumber(phone),
                      d.isManual
                          ? 'Hola $name, te escribimos de Hefesto 3D.'
                          : 'Hola $name, te escribimos de Hefesto 3D por tu pedido ${d.title}.',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    icon: const Icon(Icons.call_rounded, size: 18),
                    label: _oneLine('Llamar'),
                    onPressed: () => openUrl('tel:${phone.replaceAll(RegExp(r'[^\d+]'), '')}'),
                  ),
                ),
              ],
            ),
          ],
          if (delivery != null || address != null) ...[
            const SizedBox(height: 14),
            Divider(height: 1, color: c.border),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.place_outlined, size: 20, color: c.textDim),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (delivery != null)
                        Text(delivery, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                      if (address != null && address != delivery)
                        Text(address, style: TextStyle(color: c.textDim, fontSize: 13, height: 1.4)),
                      if (d.addressNotes != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Nota del cliente: ${d.addressNotes}',
                            style: TextStyle(color: c.textDim, fontSize: 12.5, fontStyle: FontStyle.italic),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ItemsCard extends StatelessWidget {
  const _ItemsCard(this.d);
  final SaleDetail d;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget row(String label, String value, {bool bold = false, Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            children: [
              Text(label, style: TextStyle(color: bold ? c.text : c.textDim, fontWeight: bold ? FontWeight.w800 : FontWeight.w500)),
              const Spacer(),
              Text(
                value,
                style: TextStyle(
                  fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                  fontSize: bold ? 16 : 14,
                  color: color ?? (bold ? Brand.gold : c.text),
                ),
              ),
            ],
          ),
        );

    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardTitle('Productos', trailing: MiniTag('${d.items.fold<int>(0, (s, i) => s + i.quantity)} u.')),
          for (var i = 0; i < d.items.length; i++) ...[
            if (i > 0) Divider(height: 18, color: c.border),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.items[i].name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      if (d.items[i].variant != null)
                        Text(d.items[i].variant!, style: TextStyle(color: c.textDim, fontSize: 12.5)),
                      Text(
                        '${d.items[i].quantity} × ${formatPrice(d.items[i].unitPrice)}',
                        style: TextStyle(color: c.textFaint, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Text(formatPrice(d.items[i].lineTotal), style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Divider(height: 1, color: c.border),
          const SizedBox(height: 10),
          if (!d.isManual) ...[
            row('Subtotal', formatPrice(d.subtotal)),
            if (d.discount > 0) row('Descuento', '- ${formatPrice(d.discount)}', color: Brand.success),
            row('Envío', d.shipping > 0 ? formatPrice(d.shipping) : 'Sin costo'),
            const SizedBox(height: 4),
          ],
          row('Total', formatPrice(d.total), bold: true),
          if (d.isManual && d.category != null) ...[
            const SizedBox(height: 6),
            // Texto libre de hasta 80 caracteres: se corta con "…" si no entra.
            Align(alignment: Alignment.centerLeft, child: TextTag(d.category!, icon: Icons.sell_outlined)),
          ],
        ],
      ),
    );
  }
}

/// Código de seguimiento y nota interna (solo pedidos online).
class _MetaCard extends ConsumerStatefulWidget {
  const _MetaCard({super.key, required this.d, required this.canEdit});
  final SaleDetail d;
  final bool canEdit;

  @override
  ConsumerState<_MetaCard> createState() => _MetaCardState();
}

class _MetaCardState extends ConsumerState<_MetaCard> {
  late final _tracking = TextEditingController(text: widget.d.trackingCode ?? '');
  late final _note = TextEditingController(text: widget.d.internalNote ?? '');
  bool _saving = false;

  bool get _dirty =>
      _tracking.text.trim() != (widget.d.trackingCode ?? '') ||
      _note.text.trim() != (widget.d.internalNote ?? '');

  @override
  void dispose() {
    _tracking.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiClientProvider).adminOrderMeta(
            widget.d.id,
            trackingCode:
                _tracking.text.trim() != (widget.d.trackingCode ?? '') ? _tracking.text.trim() : null,
            internalNote:
                _note.text.trim() != (widget.d.internalNote ?? '') ? _note.text.trim() : null,
          );
      invalidateSales(ref);
      if (mounted) _toast(context, 'Guardado');
    } on ApiException catch (e) {
      if (mounted) _toast(context, e.message);
    } catch (_) {
      if (mounted) _toast(context, 'No pudimos guardar. Probá de nuevo.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Envío y notas'),
          TextField(
            controller: _tracking,
            enabled: widget.canEdit,
            onChanged: (_) => setState(() {}),
            textCapitalization: TextCapitalization.characters,
            // El servidor acepta hasta 120 caracteres (con más respondía
            // "Datos inválidos." sin decir por qué).
            maxLength: 120,
            decoration: const InputDecoration(
              counterText: '',
              hintText: 'Código de seguimiento',
              prefixIcon: Icon(Icons.local_shipping_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            enabled: widget.canEdit,
            onChanged: (_) => setState(() {}),
            maxLines: 3,
            minLines: 2,
            maxLength: 2000,
            decoration: const InputDecoration(
              counterText: '',
              hintText: 'Nota interna (el cliente no la ve)',
              prefixIcon: Icon(Icons.sticky_note_2_outlined),
            ),
          ),
          if (widget.canEdit)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: GoldButton(
                label: 'Guardar',
                loading: _saving,
                onPressed: _dirty ? _save : null,
              ),
            )
          else
            Text('Solo lectura con tu rol.', style: TextStyle(fontSize: 12, color: c.textFaint)),
        ],
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard(this.d);
  final SaleDetail d;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    // El más nuevo arriba.
    final events = d.history.reversed.toList();
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _CardTitle('Historial'),
          for (var i = 0; i < events.length; i++)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 22,
                    child: Column(
                      children: [
                        const SizedBox(height: 4),
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: events[i].to.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        if (i < events.length - 1)
                          Expanded(child: Container(width: 2, color: c.border)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            events[i].from == null
                                ? 'Pedido creado · ${events[i].to.label}'
                                : events[i].to.label,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
                          ),
                          Text(
                            formatDateTime(events[i].at),
                            style: TextStyle(fontSize: 12, color: c.textFaint),
                          ),
                          if (events[i].note != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 3),
                              child: Text(
                                events[i].note!,
                                style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.35),
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
