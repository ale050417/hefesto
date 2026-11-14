import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;

import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import '../crecimiento/form_kit.dart';
import 'cliente_form_screen.dart';
import 'clientes_models.dart';
import 'clientes_providers.dart';
import 'clientes_widgets.dart';

String _monthYear(DateTime d) => DateFormat("MMMM 'de' y", 'es_AR').format(d);

/// Ficha de un cliente: contacto, métricas, pedidos, puntos y nota interna.
class CustomerDetailScreen extends ConsumerWidget {
  const CustomerDetailScreen({super.key, required this.customerId, this.initial});
  final String customerId;

  /// El cliente tal como vino en la lista (para no mostrar la pantalla vacía).
  final Customer? initial;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(adminCustomerProvider(customerId));
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('clientes', 'editar') ?? false;
    final data = detail.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(data?.customer.name ?? initial?.name ?? 'Cliente', maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          // Los registrados editan sus datos desde su cuenta; acá solo los manuales.
          if (data != null && data.customer.isManual && canEdit)
            IconButton(
              tooltip: 'Editar cliente',
              icon: const Icon(Icons.edit_rounded),
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => CustomerFormScreen(customer: data.customer)),
                );
                if (saved == true) invalidateCustomers(ref);
              },
            ),
          IconButton(
            tooltip: 'Actualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(adminCustomerProvider(customerId)),
          ),
        ],
      ),
      // (2026-11-14, pedido de Ale: que las pantallas no estén rotas.) La app
      // dibuja de borde a borde: sin esto el final de la ficha (la nota y su
      // botón "Guardar nota") quedaba debajo de la barra de gestos del sistema.
      body: SafeArea(
        top: false,
        child: detail.when(
          loading: () => const ListSkeleton(rows: 4, height: 120),
          error: (e, _) => ErrorView(
            message: errorMessage(e),
            onRetry: () => ref.invalidate(adminCustomerProvider(customerId)),
          ),
          data: (d) => RefreshIndicator(
            color: Brand.gold,
            onRefresh: () async {
              ref.invalidate(adminCustomerProvider(customerId));
              try {
                await ref.read(adminCustomerProvider(customerId).future);
              } catch (_) {
                // El error ya lo muestra la pantalla.
              }
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
              children: [
                _HeaderCard(customer: d.customer),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: StatBox(
                        label: 'Pedidos',
                        value: '${d.customer.orders}',
                        color: Brand.info,
                        icon: Icons.shopping_bag_outlined,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: StatBox(
                        label: 'Total gastado',
                        value: formatPrice(d.customer.spent),
                        icon: Icons.payments_rounded,
                      ),
                    ),
                  ],
                ),
                const AdminSectionTitle('Historial de pedidos'),
                _OrdersList(detail: d, canOpen: me?.can('pedidos', 'ver') ?? false),
                if (!d.customer.isManual) ...[
                  const AdminSectionTitle('Puntos Hefesto'),
                  _PointsCard(points: d.points),
                ],
                const AdminSectionTitle('Nota interna'),
                _NoteEditor(customer: d.customer, canEdit: canEdit),
                if (!d.customer.isManual)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 18, 4, 0),
                    child: Text(
                      'Este cliente tiene cuenta: sus datos de contacto los edita él desde la tienda. Acá podés cargarle una nota.',
                      style: TextStyle(fontSize: 11.5, color: context.hc.textFaint, height: 1.4),
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

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.customer});
  final Customer customer;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final x = customer;
    final firstName = x.name.split(' ').first;
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              InitialAvatar(x.name, size: 58),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      x.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        TierChip(x.tier, large: true),
                        if (x.isManual) const MiniTag('Manual', icon: Icons.edit_note_rounded),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('Cliente desde ${_monthYear(x.since)}',
                        style: TextStyle(fontSize: 12, color: c.textFaint)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Divider(height: 1, color: c.border),
          const SizedBox(height: 12),
          _InfoRow(
            icon: Icons.mail_outline_rounded,
            label: 'Email',
            value: x.email,
            onTap: x.email == null ? null : () => openUrl('mailto:${x.email}'),
          ),
          _InfoRow(icon: Icons.phone_outlined, label: 'Teléfono', value: x.phone),
          _InfoRow(icon: Icons.place_outlined, label: 'Ciudad', value: x.city),
          if (x.phone != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                // (2026-11-14, pedido de Ale: que las pantallas no estén rotas.)
                // En un teléfono de 360 dp "WhatsApp" no entraba y se partía en
                // dos renglones ("WhatsAp / p"): menos margen lateral y, si aun
                // así no entra (letra grande), el rótulo se achica en vez de
                // partirse. La forma y el borde salen del tema; el verde es el
                // de WhatsApp.
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: Brand.whatsapp,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(44),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    icon: const Icon(Icons.chat_rounded, size: 18),
                    label: const FittedBox(fit: BoxFit.scaleDown, child: Text('WhatsApp')),
                    onPressed: () => openWhatsapp(
                      customerWaNumber(x.phone!),
                      '¡Hola $firstName! Te escribimos de Hefesto 3D.',
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
                    label: const FittedBox(fit: BoxFit.scaleDown, child: Text('Llamar')),
                    onPressed: () => openUrl('tel:${x.phone!.replaceAll(RegExp(r'[^\d+]'), '')}'),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value, this.onTap});
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 19, color: c.textDim),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 11, color: c.textFaint)),
                  Text(
                    value ?? '—',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, color: value == null ? c.textFaint : c.text),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrdersList extends StatelessWidget {
  const _OrdersList({required this.detail, required this.canOpen});
  final CustomerDetail detail;
  final bool canOpen;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    if (detail.orders.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(left: 4),
        child: Text(
          detail.customer.isManual
              ? 'Los clientes manuales no tienen pedidos del sistema asociados.'
              : 'Sin pedidos aún.',
          style: TextStyle(fontSize: 13, color: c.textFaint),
        ),
      );
    }
    return Column(
      children: [
        for (final o in detail.orders) ...[
          AdminCard(
            padding: const EdgeInsets.fromLTRB(14, 11, 14, 11),
            onTap: canOpen ? () => context.push('/admin/venta/online/${o.id}') : null,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(o.orderNumber, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(formatDay(o.createdAt), style: TextStyle(fontSize: 11.5, color: c.textFaint)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatPrice(o.total),
                      style: const TextStyle(
                        fontFamily: 'Orbitron',
                        fontWeight: FontWeight.w700,
                        fontSize: 13.5,
                        color: Brand.gold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    StatusChip(o.status),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
        if (detail.orders.length >= 50)
          Padding(
            padding: const EdgeInsets.only(top: 2, left: 4),
            child: Text('Se muestran los últimos 50 pedidos.',
                style: TextStyle(fontSize: 11.5, color: c.textFaint)),
          ),
      ],
    );
  }
}

class _PointsCard extends StatelessWidget {
  const _PointsCard({required this.points});
  final PointsSummary points;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      accent: Brand.gold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_rounded, size: 20, color: Brand.gold),
              const SizedBox(width: 8),
              const Expanded(
                child: Text('Saldo', style: TextStyle(fontWeight: FontWeight.w700, color: Brand.gold)),
              ),
              Text(
                '${points.balance}',
                style: const TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w800,
                  fontSize: 22,
                  color: Brand.gold,
                ),
              ),
              const SizedBox(width: 4),
              Text('pts', style: TextStyle(fontSize: 12, color: c.textFaint)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${points.earned} acumulados · ${points.redeemed} canjeados',
            style: TextStyle(fontSize: 12, color: c.textFaint),
          ),
          if (points.redemptions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Divider(height: 1, color: c.border),
            const SizedBox(height: 10),
            Text('CANJES REALIZADOS',
                style: TextStyle(fontSize: 10.5, letterSpacing: 1.2, color: c.textFaint, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            for (final r in points.redemptions)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 1),
                      child: Icon(Icons.card_giftcard_rounded, size: 16, color: Brand.gold),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r.reason, style: const TextStyle(fontSize: 13)),
                          Text(formatDay(r.createdAt), style: TextStyle(fontSize: 11, color: c.textFaint)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
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
          ],
        ],
      ),
    );
  }
}

/// Nota interna del taller sobre el cliente. Guarda solo si hay cambios.
class _NoteEditor extends ConsumerStatefulWidget {
  const _NoteEditor({required this.customer, required this.canEdit});
  final Customer customer;
  final bool canEdit;

  @override
  ConsumerState<_NoteEditor> createState() => _NoteEditorState();
}

class _NoteEditorState extends ConsumerState<_NoteEditor> {
  late final TextEditingController _ctl = TextEditingController(text: widget.customer.note ?? '');
  late String _saved = widget.customer.note ?? '';
  bool _busy = false;
  String? _error;

  bool get _dirty => _ctl.text.trim() != _saved.trim();

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _NoteEditor old) {
    super.didUpdateWidget(old);
    // Si la ficha se recargó con otra nota y no estoy tipeando, la tomo.
    final fresh = widget.customer.note ?? '';
    if (fresh != (old.customer.note ?? '') && !_dirty) {
      _ctl.text = fresh;
      _saved = fresh;
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await saveCustomerNote(ref.read(apiClientProvider), widget.customer, _ctl.text);
      _saved = _ctl.text.trim();
      if (!mounted) return;
      showToast(context, 'Nota guardada');
      invalidateCustomers(ref);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _ctl,
            readOnly: !widget.canEdit,
            enabled: !_busy,
            minLines: 3,
            maxLines: 6,
            maxLength: 1000,
            textCapitalization: TextCapitalization.sentences,
            // Al abrirse el teclado se lleva a la vista el campo entero y el
            // botón "Guardar nota" de abajo (por defecto solo sube el renglón
            // del cursor y el resto quedaba tapado por el teclado).
            scrollPadding: const EdgeInsets.fromLTRB(20, 20, 20, 140),
            onChanged: (_) => setState(() => _error = null),
            decoration: const InputDecoration(
              hintText: 'Preferencias, observaciones…',
              counterText: '',
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            FormErrorBanner(_error!),
          ],
          if (widget.canEdit) ...[
            const SizedBox(height: 10),
            GoldButton(
              label: 'Guardar nota',
              icon: Icons.save_rounded,
              loading: _busy,
              onPressed: _dirty ? _save : null,
            ),
          ],
        ],
      ),
    );
  }
}
