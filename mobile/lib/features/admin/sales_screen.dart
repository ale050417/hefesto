import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import 'admin_models.dart';
import 'admin_providers.dart';
import 'admin_widgets.dart';
import 'sale_status.dart';
import 'ventas_extra/manual_sale_form_screen.dart';

/// Ventas unificadas: pedidos de la tienda + ventas de mostrador.
class AdminSalesScreen extends ConsumerStatefulWidget {
  const AdminSalesScreen({super.key, this.initialStatus});

  /// Valor de la API (`pending_payment`…) cuando se llega desde un atajo del inicio.
  final String? initialStatus;

  @override
  ConsumerState<AdminSalesScreen> createState() => _AdminSalesScreenState();
}

class _AdminSalesScreenState extends ConsumerState<AdminSalesScreen> {
  final _searchCtl = TextEditingController();
  Timer? _debounce;
  String _type = 'all';
  String? _status;
  String _q = '';

  /// Una clave por chip de estado (para traer a la vista el elegido).
  final _statusKeys = {for (final s in SaleStatus.values) s.api: GlobalKey()};

  @override
  void initState() {
    super.initState();
    _status = SaleStatus.values.any((s) => s.api == widget.initialStatus)
        ? widget.initialStatus
        : null;
    if (_status != null) {
      // Llegando desde un atajo del inicio ("Listos", "En producción") el
      // filtro elegido quedaba fuera de la pantalla: la lista se veía filtrada
      // sin ningún estado marcado. Se desplaza la fila hasta mostrarlo.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final chip = _statusKeys[_status]?.currentContext;
        if (chip != null) {
          Scrollable.ensureVisible(chip, alignment: 0.5, duration: const Duration(milliseconds: 200));
        }
      });
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtl.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    // Espera a que se deje de tipear para no pedir al servidor por cada letra.
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _q = v.trim());
    });
    setState(() {}); // refresca el botón de limpiar
  }

  SalesFilter get _filter => (type: _type, status: _status, q: _q);

  Future<void> _refresh() async {
    ref.invalidate(adminSalesProvider(_filter));
    try {
      await ref.read(adminSalesProvider(_filter).future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    if (me != null && !me.can('pedidos', 'ver')) {
      return Scaffold(
        appBar: const AdminAppBar(title: 'Ventas'),
        body: const AccessDenied(what: 'las ventas'),
      );
    }

    final sales = ref.watch(adminSalesProvider(_filter));
    final canCreate = me?.can('pedidos', 'crear') ?? false;

    return Scaffold(
      appBar: const AdminAppBar(title: 'Ventas'),
      // Cargar una venta de mostrador (permiso pedidos/crear, como en la web).
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              heroTag: 'nueva-venta',
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nueva venta'),
              // Sobre la barra del panel (navegador raíz), igual que el detalle:
              // si se abría dentro de la pestaña, la barra de abajo quedaba viva
              // debajo del formulario y de sus hojas ("Texto libre", producto).
              onPressed: () => Navigator.of(context, rootNavigator: true).push(
                MaterialPageRoute<bool>(builder: (_) => const ManualSaleFormScreen()),
              ),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: TextField(
              controller: _searchCtl,
              onChanged: _onSearch,
              textInputAction: TextInputAction.search,
              // El servidor acepta búsquedas de hasta 80 caracteres.
              inputFormatters: [LengthLimitingTextInputFormatter(80)],
              decoration: InputDecoration(
                hintText: 'Buscar cliente, producto o número…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchCtl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _searchCtl.clear();
                          _debounce?.cancel();
                          setState(() => _q = '');
                        },
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
                for (final t in const [
                  ('all', 'Todas', Icons.apps_rounded),
                  ('online', 'Tienda', Icons.shopping_bag_outlined),
                  ('manual', 'Mostrador', Icons.point_of_sale_rounded),
                ]) ...[
                  ChoiceChip(
                    avatar: Icon(
                      t.$3,
                      size: 16,
                      color: _type == t.$1 ? Brand.gold : c.textDim,
                    ),
                    label: Text(t.$2),
                    selected: _type == t.$1,
                    onSelected: (_) => setState(() => _type = t.$1),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 38,
            // Fila entera armada (no perezosa): así el estado elegido existe
            // aunque esté fuera de la pantalla y se lo puede traer a la vista.
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('Todos los estados'),
                    selected: _status == null,
                    onSelected: (_) => setState(() => _status = null),
                  ),
                  for (final s in SaleStatus.values) ...[
                    const SizedBox(width: 8),
                    ChoiceChip(
                      key: _statusKeys[s.api],
                      avatar: Icon(s.icon, size: 15, color: s.color),
                      label: Text(s.label),
                      selected: _status == s.api,
                      onSelected: (_) => setState(() => _status = _status == s.api ? null : s.api),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: sales.when(
              loading: () => const ListSkeleton(rows: 6),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(adminSalesProvider(_filter)),
              ),
              data: (page) => RefreshIndicator(
                color: Brand.gold,
                onRefresh: _refresh,
                child: page.items.isEmpty
                    ? ListView(
                        children: [
                          const SizedBox(height: 60),
                          EmptyView(
                            icon: Icons.receipt_long_rounded,
                            title: 'No hay ventas para mostrar',
                            subtitle: (_q.isNotEmpty || _status != null || _type != 'all')
                                ? 'Probá quitando algún filtro o cambiando la búsqueda.'
                                : 'Cuando entre un pedido o cargues una venta, aparece acá.',
                          ),
                        ],
                      )
                    : ListView.separated(
                        // Con el botón flotante, deja lugar para no taparle la última fila.
                        padding: EdgeInsets.fromLTRB(16, 4, 16, canCreate ? 88 : 24),
                        itemCount: page.items.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, i) {
                          if (i == 0) {
                            return Padding(
                              padding: const EdgeInsets.fromLTRB(4, 4, 0, 0),
                              child: Text(
                                page.total > page.items.length
                                    ? 'Mostrando ${page.items.length} de ${page.total} ventas'
                                    : '${page.total} ${page.total == 1 ? 'venta' : 'ventas'}',
                                style: TextStyle(fontSize: 12, color: c.textFaint),
                              ),
                            );
                          }
                          final row = page.items[i - 1];
                          return SaleTile(
                            row: row,
                            onTap: () => context.push('/admin/venta/${row.source}/${row.id}'),
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
