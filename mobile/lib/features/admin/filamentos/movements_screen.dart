import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'filamentos_api.dart';
import 'movement_tile.dart';

const _filters = <(String, String?)>[
  ('Todos', null),
  ('Ventas', 'order'),
  ('Mostrador', 'manual_sale'),
  ('Fallas', 'failure'),
  ('Ajustes', 'adjust'),
  ('Reposiciones', 'restore'),
];

/// Historial general del stock de filamento: todo lo que sumó o restó (ventas,
/// fallas, ajustes y reposiciones), del más nuevo al más viejo.
class FilamentMovementsScreen extends ConsumerStatefulWidget {
  const FilamentMovementsScreen({super.key});

  @override
  ConsumerState<FilamentMovementsScreen> createState() => _FilamentMovementsScreenState();
}

class _FilamentMovementsScreenState extends ConsumerState<FilamentMovementsScreen> {
  String? _reason;

  Future<void> _refresh() async {
    ref.invalidate(filamentMovementsProvider(null));
    try {
      await ref.read(filamentMovementsProvider(null).future);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    final denied = me != null && !me.can('filamentos', 'ver');
    final movs = ref.watch(filamentMovementsProvider(null));

    return Scaffold(
      appBar: AppBar(title: const Text('Historial de stock')),
      // La app dibuja de borde a borde: sin `SafeArea` el final del historial
      // quedaba debajo de la barra de gestos / de los tres botones del sistema.
      body: SafeArea(
        top: false,
        child: denied
          ? const AccessDenied(what: 'el historial de filamentos')
          : movs.when(
              loading: () => const ListSkeleton(rows: 7, height: 64),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(filamentMovementsProvider(null)),
              ),
              data: (all) {
                final list = _reason == null ? all : all.where((m) => m.reason == _reason).toList();
                return RefreshIndicator(
                  color: Brand.gold,
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final f in _filters) ...[
                              ChoiceChip(
                                label: Text(f.$1),
                                selected: _reason == f.$2,
                                onSelected: (_) => setState(() => _reason = f.$2),
                              ),
                              const SizedBox(width: 8),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (list.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 40),
                          child: EmptyView(
                            icon: Icons.history_rounded,
                            title: 'Sin movimientos',
                            subtitle: 'Acá aparecen las ventas, fallas y ajustes que mueven el stock.',
                          ),
                        )
                      else
                        AdminCard(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                          child: Column(
                            children: [
                              for (var i = 0; i < list.length; i++) ...[
                                if (i > 0) Divider(height: 1, color: context.hc.border),
                                MovementTile(list[i]),
                              ],
                            ],
                          ),
                        ),
                      if (all.length >= 100)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Center(
                            child: Text(
                              'Se muestran los últimos 100 movimientos.',
                              style: TextStyle(fontSize: 11.5, color: context.hc.textFaint),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
      ),
    );
  }
}
