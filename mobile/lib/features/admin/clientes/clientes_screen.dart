import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import '../crecimiento/form_kit.dart';
import 'cliente_detail_screen.dart';
import 'cliente_form_screen.dart';
import 'clientes_models.dart';
import 'clientes_providers.dart';
import 'clientes_widgets.dart';

/// Clientes: lista con búsqueda y nivel, ficha con pedidos y puntos, alta de
/// clientes manuales y WhatsApp. (Pantalla de entrada del módulo; se abre desde
/// "Más".)
class AdminClientesScreen extends ConsumerWidget {
  const AdminClientesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('clientes', 'crear') ?? false;
    return AdminModuleScaffold(
      title: 'Clientes',
      permission: 'clientes',
      what: 'los clientes',
      actions: [
        IconButton(
          tooltip: 'Cómo se calculan los niveles',
          icon: const Icon(Icons.info_outline_rounded),
          onPressed: () => _showTierRules(context, ref.read(adminCustomersProvider).value),
        ),
      ],
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              backgroundColor: Brand.gold,
              foregroundColor: Brand.goldFg,
              icon: const Icon(Icons.person_add_alt_1_rounded),
              label: const Text('Nuevo cliente'),
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(builder: (_) => const CustomerFormScreen()),
                );
                if (saved == true) invalidateCustomers(ref);
              },
            )
          : null,
      body: const _ClientesBody(),
    );
  }
}

void _showTierRules(BuildContext context, CustomersPage? page) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (ctx) {
      final c = ctx.hc;
      String rule(CustomerTier t) {
        final r = page?.tiers[t];
        if (r == null || (r.minSpent <= 0 && r.minOrders <= 0)) return 'Clientes recién llegados';
        return 'Desde ${formatPrice(r.minSpent)} en compras o ${r.minOrders} pedidos';
      }

      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Niveles de cliente', style: Theme.of(ctx).textTheme.titleLarge),
            const SizedBox(height: 4),
            Text(
              'Se calculan solos con lo que compró cada cliente (pedidos de la tienda, sin cancelados).',
              style: TextStyle(color: c.textDim, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 16),
            for (final t in CustomerTier.values)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: t.color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(t.icon, size: 18, color: t.color),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            page?.tiers[t]?.label.isNotEmpty == true ? page!.tiers[t]!.label : t.label,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          Text(rule(t), style: TextStyle(color: c.textDim, fontSize: 12.5)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      );
    },
  );
}

class _ClientesBody extends ConsumerStatefulWidget {
  const _ClientesBody();

  @override
  ConsumerState<_ClientesBody> createState() => _ClientesBodyState();
}

class _ClientesBodyState extends ConsumerState<_ClientesBody> {
  final _search = TextEditingController();
  CustomerTier? _tier;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(adminCustomersProvider);
    try {
      await ref.read(adminCustomersProvider.future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final customers = ref.watch(adminCustomersProvider);
    final page = customers.value;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Buscar nombre, teléfono o ciudad…',
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
        const SizedBox(height: 10),
        SizedBox(
          height: 38,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            children: [
              ChoiceChip(
                label: Text(page == null ? 'Todos' : 'Todos (${page.counts.all})'),
                selected: _tier == null,
                onSelected: (_) => setState(() => _tier = null),
              ),
              for (final t in CustomerTier.values) ...[
                const SizedBox(width: 8),
                ChoiceChip(
                  avatar: Icon(t.icon, size: 16, color: t.color),
                  label: Text(page == null ? t.label : '${t.label} (${page.counts.of(t)})'),
                  selected: _tier == t,
                  onSelected: (_) => setState(() => _tier = _tier == t ? null : t),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: customers.when(
            loading: () => const ListSkeleton(rows: 6, height: 96),
            error: (e, _) => ErrorView(
              message: errorMessage(e),
              onRetry: () => ref.invalidate(adminCustomersProvider),
            ),
            data: (page) {
              final q = _search.text;
              final shown = page.items
                  .where((x) => (_tier == null || x.tier == _tier) && x.matches(q))
                  .toList();
              final filtered = q.trim().isNotEmpty || _tier != null;
              return RefreshIndicator(
                color: Brand.gold,
                onRefresh: _refresh,
                child: shown.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 60),
                          EmptyView(
                            icon: filtered ? Icons.search_off_rounded : Icons.people_alt_rounded,
                            title: filtered ? 'No se encontraron clientes' : 'Todavía no hay clientes',
                            subtitle: filtered
                                ? 'Probá con otra búsqueda o quitá el filtro de nivel.'
                                : 'Cuando alguien se registre o cargues un cliente a mano, aparece acá.',
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                        itemCount: shown.length + 2,
                        separatorBuilder: (_, i) => SizedBox(height: i == 0 ? 12 : 10),
                        itemBuilder: (_, i) {
                          if (i == 0) {
                            return Row(
                              children: [
                                Expanded(
                                  child: StatBox(
                                    label: 'Clientes',
                                    value: '${page.counts.all}',
                                    color: Brand.info,
                                    icon: Icons.people_alt_rounded,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: StatBox(
                                    label: 'Compras totales',
                                    value: formatPrice(page.totalSpent),
                                    icon: Icons.payments_rounded,
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
                                    : '${shown.length} ${shown.length == 1 ? 'cliente' : 'clientes'}',
                                style: TextStyle(fontSize: 12, color: c.textFaint),
                              ),
                            );
                          }
                          final cust = shown[i - 2];
                          return CustomerTile(
                            customer: cust,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => CustomerDetailScreen(customerId: cust.id, initial: cust),
                              ),
                            ),
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

/// Fila de un cliente en la lista.
class CustomerTile extends StatelessWidget {
  const CustomerTile({super.key, required this.customer, required this.onTap});
  final Customer customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final x = customer;
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InitialAvatar(x.name),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  x.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                ),
                const SizedBox(height: 2),
                Text(
                  x.contactLine,
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
                    TierChip(x.tier),
                    if (x.isManual) const MiniTag('Manual', icon: Icons.edit_note_rounded),
                    if (x.city != null) MiniTag(x.city!, icon: Icons.place_outlined),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 104),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    formatPrice(x.spent),
                    style: const TextStyle(
                      fontFamily: 'Orbitron',
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      color: Brand.gold,
                    ),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${x.orders} ${x.orders == 1 ? 'pedido' : 'pedidos'}',
                  style: TextStyle(fontSize: 11.5, color: c.textFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
