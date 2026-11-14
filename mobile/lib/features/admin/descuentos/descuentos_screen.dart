import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../crecimiento/form_kit.dart';
import 'cupon_form_screen.dart';
import 'descuentos_models.dart';
import 'descuentos_providers.dart';

/// Descuentos: cupones con su estado y usos; crear, editar, pausar y eliminar.
/// (Pantalla de entrada del módulo; se abre desde "Más".)
class AdminDescuentosScreen extends ConsumerWidget {
  const AdminDescuentosScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('descuentos', 'crear') ?? false;
    return AdminModuleScaffold(
      title: 'Descuentos',
      permission: 'descuentos',
      what: 'los descuentos',
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              backgroundColor: Brand.gold,
              foregroundColor: Brand.goldFg,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Crear cupón'),
              onPressed: () => _openForm(context, ref),
            )
          : null,
      body: const _DescuentosBody(),
    );
  }
}

Future<void> _openForm(BuildContext context, WidgetRef ref, {Coupon? coupon}) async {
  final saved = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => CouponFormScreen(coupon: coupon)),
  );
  if (saved == true) ref.invalidate(adminCouponsProvider);
}

class _DescuentosBody extends ConsumerStatefulWidget {
  const _DescuentosBody();

  @override
  ConsumerState<_DescuentosBody> createState() => _DescuentosBodyState();
}

class _DescuentosBodyState extends ConsumerState<_DescuentosBody> {
  final _search = TextEditingController();
  CouponStatus? _status;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(adminCouponsProvider);
    try {
      await ref.read(adminCouponsProvider.future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  Future<void> _toggle(Coupon c) async {
    try {
      await setCouponActive(ref.read(apiClientProvider), c.id, !c.isActive);
      ref.invalidate(adminCouponsProvider);
      if (mounted) showToast(context, c.isActive ? 'Cupón pausado' : 'Cupón activado');
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e));
    }
  }

  Future<void> _delete(Coupon c) async {
    final ok = await confirmAction(
      context,
      title: '¿Eliminar el cupón ${c.code}?',
      message: 'Se eliminará también su historial de canjes. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await deleteCoupon(ref.read(apiClientProvider), c.id);
      ref.invalidate(adminCouponsProvider);
      if (mounted) showToast(context, 'Cupón eliminado');
    } catch (e) {
      if (mounted) showToast(context, errorMessage(e));
    }
  }

  Future<void> _copy(String text, String done) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) showToast(context, done);
  }

  void _onMenu(String action, Coupon c) {
    switch (action) {
      case 'edit':
        _openForm(context, ref, coupon: c);
      case 'toggle':
        _toggle(c);
      case 'copy':
        _copy(c.code, 'Código copiado');
      case 'link':
        _copy(c.shareLink(AppConfig.siteUrl), 'Link copiado');
      case 'whatsapp':
        openWhatsapp(
          null,
          '¡Usá el cupón ${c.code} (${c.valueLabel} de descuento) en Hefesto 3D! '
          '${c.shareLink(AppConfig.siteUrl)}',
        );
      case 'delete':
        _delete(c);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('descuentos', 'editar') ?? false;
    final canDelete = me?.can('descuentos', 'eliminar') ?? false;
    final coupons = ref.watch(adminCouponsProvider);
    final page = coupons.value;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Buscar por código o descripción…',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Borrar búsqueda',
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () => setState(_search.clear),
                    ),
            ),
          ),
        ),
        // (2026-11-14, pedido de Ale: que todo se pueda tocar bien.) La fila
        // mide 48 dp, el alto que necesita cada filtro para tocarse con el
        // dedo (con 38 quedaba recortado). El dibujo del filtro no cambia: los
        // márgenes de arriba y de abajo se achicaron lo mismo.
        const SizedBox(height: 5),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              ChoiceChip(
                label: Text(page == null ? 'Todos' : 'Todos (${page.counts.total})'),
                selected: _status == null,
                onSelected: (_) => setState(() => _status = null),
              ),
              for (final s in CouponStatus.values) ...[
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: Icon(s.icon, size: 16, color: s.color),
                  label: Text(page == null ? s.plural : '${s.plural} (${page.counts.of(s)})'),
                  selected: _status == s,
                  onSelected: (_) => setState(() => _status = _status == s ? null : s),
                ),
              ],
            ],
          ),
        ),
        Expanded(
          child: coupons.when(
            loading: () => const ListSkeleton(rows: 4, height: 150),
            error: (e, _) => ErrorView(
              message: errorMessage(e),
              onRetry: () => ref.invalidate(adminCouponsProvider),
            ),
            data: (page) {
              final shown = page.items
                  .where((x) => (_status == null || x.status == _status) && x.matches(_search.text))
                  .toList();
              final filtered = _search.text.trim().isNotEmpty || _status != null;
              return RefreshIndicator(
                color: Brand.gold,
                onRefresh: _refresh,
                child: shown.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 60),
                          EmptyView(
                            icon: filtered ? Icons.search_off_rounded : Icons.local_offer_rounded,
                            title: filtered ? 'No hay cupones para mostrar' : 'Todavía no hay cupones',
                            subtitle: filtered
                                ? 'Probá con otra búsqueda o quitá el filtro de estado.'
                                : 'Un cupón es un código que el cliente escribe al pagar: porcentaje o monto fijo, con tope de usos y vencimiento.',
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                        itemCount: shown.length + 2,
                        separatorBuilder: (_, i) => SizedBox(height: i == 0 ? 12 : 12),
                        itemBuilder: (_, i) {
                          if (i == 0) {
                            return Row(
                              children: [
                                Expanded(
                                  child: StatBox(
                                    label: 'Cupones activos',
                                    value: '${page.counts.active}',
                                    color: Brand.success,
                                    icon: Icons.check_circle_rounded,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: StatBox(
                                    label: 'Usos totales',
                                    value: '${page.counts.uses}',
                                    icon: Icons.confirmation_number_rounded,
                                  ),
                                ),
                              ],
                            );
                          }
                          if (i == 1) {
                            return Padding(
                              padding: const EdgeInsets.only(left: 4),
                              child: Text(
                                filtered
                                    ? 'Mostrando ${shown.length} de ${page.items.length}'
                                    : '${shown.length} ${shown.length == 1 ? 'cupón' : 'cupones'}',
                                style: TextStyle(fontSize: 12, color: c.textFaint),
                              ),
                            );
                          }
                          final cp = shown[i - 2];
                          return CouponCard(
                            coupon: cp,
                            canEdit: canEdit,
                            canDelete: canDelete,
                            onTap: canEdit ? () => _openForm(context, ref, coupon: cp) : null,
                            onMenu: (a) => _onMenu(a, cp),
                          );
                        },
                      ),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Un cupón como "ticket": código y estado a la izquierda, valor a la derecha,
/// y abajo vencimiento, usos y el menú de acciones.
class CouponCard extends StatelessWidget {
  const CouponCard({
    super.key,
    required this.coupon,
    required this.canEdit,
    required this.canDelete,
    required this.onMenu,
    this.onTap,
  });
  final Coupon coupon;
  final bool canEdit;
  final bool canDelete;
  final VoidCallback? onTap;
  final ValueChanged<String> onMenu;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final x = coupon;
    final faded = x.status != CouponStatus.active;
    final String expiry;
    if (x.expiresAt == null) {
      expiry = 'Sin vencimiento';
    } else {
      expiry = '${x.status == CouponStatus.expired ? 'Venció el' : 'Vence el'} ${formatExpiry(x.expiresAt!)}';
    }

    return AdminCard(
      padding: EdgeInsets.zero,
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(19),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
                      child: Opacity(
                        opacity: faded ? 0.7 : 1,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                CouponStatusChip(x.status),
                                if (x.birthdayOnly) const MiniTag('Cumpleaños', icon: Icons.cake_rounded),
                                if (x.isRewardCoupon) const MiniTag('Premio', icon: Icons.card_giftcard_rounded),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              x.code,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: 'Orbitron',
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                                letterSpacing: 0.8,
                                color: Brand.gold,
                              ),
                            ),
                            if (x.description != null) ...[
                              const SizedBox(height: 3),
                              Text(
                                x.description!,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12.5, color: c.textDim, height: 1.3),
                              ),
                            ],
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Icon(Icons.sell_outlined, size: 13, color: c.textFaint),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    x.scopeLabel,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(fontSize: 11.5, color: c.textFaint),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Container(
                    width: 104,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      color: c.surface2,
                      border: Border(left: BorderSide(color: c.border)),
                    ),
                    child: Opacity(
                      opacity: faded ? 0.6 : 1,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              x.valueLabel,
                              style: const TextStyle(fontFamily: 'Orbitron', fontWeight: FontWeight.w800, fontSize: 24),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            x.isPercent ? 'DESCUENTO' : 'FIJO',
                            style: TextStyle(fontSize: 10, letterSpacing: 1.2, color: c.textFaint, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: c.border),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 4, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(expiry, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.textDim)),
                        Text(
                          '${x.usedCount}${x.maxUses != null ? '/${x.maxUses}' : ''} ${x.usedCount == 1 && x.maxUses == null ? 'uso' : 'usos'}'
                          '${x.minPurchase > 0 ? ' · mín. ${formatPrice(x.minPurchase)}' : ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11.5, color: c.textFaint),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    tooltip: 'Acciones del cupón',
                    icon: Icon(Icons.more_vert_rounded, color: c.textDim),
                    onSelected: onMenu,
                    itemBuilder: (_) => [
                      if (canEdit)
                        const PopupMenuItem(value: 'edit', child: _MenuRow(Icons.edit_rounded, 'Editar')),
                      if (canEdit && x.status != CouponStatus.expired)
                        PopupMenuItem(
                          value: 'toggle',
                          child: _MenuRow(
                            x.isActive ? Icons.pause_circle_outline_rounded : Icons.play_circle_outline_rounded,
                            x.isActive ? 'Pausar' : 'Activar',
                          ),
                        ),
                      const PopupMenuItem(value: 'copy', child: _MenuRow(Icons.copy_rounded, 'Copiar código')),
                      const PopupMenuItem(value: 'link', child: _MenuRow(Icons.link_rounded, 'Copiar link directo')),
                      const PopupMenuItem(value: 'whatsapp', child: _MenuRow(Icons.chat_rounded, 'Compartir por WhatsApp')),
                      if (canDelete)
                        const PopupMenuItem(
                          value: 'delete',
                          child: _MenuRow(Icons.delete_outline_rounded, 'Eliminar', danger: true),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (x.maxUses != null)
              LinearProgressIndicator(
                value: x.usage,
                minHeight: 4,
                backgroundColor: c.surface3,
                valueColor: AlwaysStoppedAnimation(x.usage >= 1 ? Brand.danger : Brand.gold),
              ),
          ],
        ),
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? Brand.danger : context.hc.text;
    return Row(
      children: [
        Icon(icon, size: 19, color: danger ? Brand.danger : context.hc.textDim),
        const SizedBox(width: 12),
        Flexible(child: Text(label, style: TextStyle(color: color))),
      ],
    );
  }
}

/// Píldora de estado del cupón.
class CouponStatusChip extends StatelessWidget {
  const CouponStatusChip(this.status, {super.key});
  final CouponStatus status;

  @override
  Widget build(BuildContext context) {
    final color = status.color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(status.icon, size: 12, color: color),
          const SizedBox(width: 4),
          Text(status.label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
        ],
      ),
    );
  }
}
