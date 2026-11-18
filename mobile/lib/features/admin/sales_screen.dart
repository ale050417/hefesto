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
import 'pendientes/pendientes_api.dart';
import 'pendientes/pendientes_screen.dart';
import 'sale_month.dart';
import 'sale_status.dart';
import 'ventas_extra/manual_sale_form_screen.dart';

/// "Ahora", para saber cuál es el mes actual (en los tests se fija una fecha).
final salesNowProvider = Provider<DateTime Function()>((ref) => DateTime.now);

/// Ventas unificadas: pedidos de la tienda + ventas de mostrador.
///
/// Pedido de Agustín (2026-11-17), igual que el tablero de Pedidos de la web:
/// arranca en el MES ACTUAL (hora de Argentina), con flechas para ir mes a mes
/// y "Todos los meses"; los estados muestran cuántas hay en ese mes y, si
/// quedaron ventas sin cerrar de meses anteriores, se avisa arriba. Arriba de
/// todo, la entrada a los "Pendientes del equipo".
///
/// El servidor filtra por tipo, estado y texto, y devuelve como mucho las 200
/// más nuevas: NO sabe filtrar por mes. Por eso acá se piden las ventas del
/// tipo y la búsqueda elegidos y el mes y el estado se filtran en el teléfono
/// (así los contadores de cada estado salen de la misma lista). Si hay más de
/// 200, se avisa y, al elegir UN estado, ese estado se le pide al servidor
/// para llegar también a las más viejas.
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
  SaleStatusFilter _status = SaleStatusFilter.all;
  String _q = '';

  /// Mes de hoy en hora de Argentina ("2026-11").
  late final String _currentMonth = monthKeyOf(ref.read(salesNowProvider)());

  /// Mes que se está mirando; null = todos los meses.
  String? _month;

  /// Una clave por chip de estado (para traer a la vista el elegido).
  final _statusKeys = {for (final s in SaleStatus.values) s.api: GlobalKey()};

  @override
  void initState() {
    super.initState();
    _month = _currentMonth;
    for (final s in SaleStatus.values) {
      if (s.api == widget.initialStatus) _status = SaleStatusFilter.only(s);
    }
    if (_status.status != null) {
      // Desde un atajo del inicio ("Listos", "En producción") se ven TODOS los
      // meses: el número del inicio cuenta todas, no solo las de este mes.
      _month = null;
      _revealStatus = true;
    }
  }

  /// Llegando desde un atajo, el estado elegido quedaba fuera de la pantalla:
  /// la lista se veía filtrada sin ningún estado marcado. Se desplaza la fila
  /// hasta mostrarlo (una vez, cuando ya están los contadores: antes de eso
  /// los chips son más angostos y quedaría corrido).
  bool _revealStatus = false;

  void _revealChosenStatus() {
    _revealStatus = false;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final chip = _statusKeys[_status.status?.api]?.currentContext;
      if (chip != null) {
        Scrollable.ensureVisible(chip, alignment: 0.5, duration: const Duration(milliseconds: 200));
      }
    });
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

  /// Lo que se le pide al servidor: tipo y búsqueda (sin estado, ver arriba).
  SalesFilter get _filter => (type: _type, status: null, q: _q);

  /// El mismo pedido con UN estado (solo cuando hay más ventas de las que llegan).
  SalesFilter _statusFilter(SaleStatus s) => (type: _type, status: s.api, q: _q);

  Future<void> _refresh() async {
    ref.invalidate(adminSalesProvider);
    ref.invalidate(pendientesProvider);
    try {
      await ref.read(adminSalesProvider(_filter).future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  void _step(int delta) => setState(() => _month = stepMonth(_month ?? _currentMonth, delta));

  /// "Ver" del aviso de atrasadas: todos los meses + lo que sigue sin cerrar.
  void _showOverdue() => setState(() {
        _month = null;
        _status = SaleStatusFilter.unclosed;
      });

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    if (me != null && !me.can('pedidos', 'ver')) {
      return Scaffold(
        appBar: const AdminAppBar(title: 'Ventas'),
        body: const AccessDenied(what: 'las ventas'),
      );
    }

    final sales = ref.watch(adminSalesProvider(_filter));
    final canCreate = me?.can('pedidos', 'crear') ?? false;
    final page = sales.value;
    final truncated = page != null && page.total > page.items.length;
    if (_revealStatus && page != null) _revealChosenStatus();
    // Con más ventas de las que llegan, UN estado se le pide al servidor.
    final one = _status.status;
    final exact = truncated && one != null ? ref.watch(adminSalesProvider(_statusFilter(one))) : null;

    final view = buildSalesMonthView(page?.items ?? const [], month: _month, status: _status);
    final exactRows = exact?.value?.items;
    final rows = exactRows == null
        ? view.list
        : [
            for (final r in exactRows)
              if (_month == null || monthKeyOf(r.date) == _month) r,
          ];
    final waitingExact = exact != null && exactRows == null && !exact.hasError;

    // Qué va debajo de los filtros.
    final List<Widget> content;
    if (sales.isLoading && page == null || waitingExact) {
      content = [
        for (var i = 0; i < 5; i++)
          const Padding(padding: EdgeInsets.only(bottom: 10), child: Skeleton(height: 92, radius: 20)),
      ];
    } else if (sales.hasError && page == null) {
      content = [
        ErrorView(
          message: '${sales.error}',
          onRetry: () => ref.invalidate(adminSalesProvider(_filter)),
        ),
      ];
    } else if (rows.isEmpty) {
      final filtered = _q.isNotEmpty || !_status.isAll || _type != 'all';
      content = [
        const SizedBox(height: 12),
        EmptyView(
          icon: Icons.receipt_long_rounded,
          title: _month == null ? 'No hay ventas para mostrar' : 'No hay ventas en ${monthLabel(_month!)}',
          subtitle: filtered
              ? 'Probá quitando algún filtro o cambiando la búsqueda.'
              : _month == null
                  ? 'Cuando entre un pedido o cargues una venta, aparece acá.'
                  : 'Mirá otro mes con las flechas, o tocá "Todos los meses".',
        ),
      ];
    } else {
      content = const [];
    }

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
                // Corto a propósito: en un teléfono de 360 dp uno más largo se cortaba.
                hintText: 'Cliente, producto o número…',
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
          const SizedBox(height: 6),
          Expanded(
            child: RefreshIndicator(
              color: Brand.gold,
              onRefresh: _refresh,
              // Los filtros van DENTRO de la lista (se van al desplazar): fijos
              // arriba, en un teléfono chico dejaban dos ventas a la vista.
              child: ListView.builder(
                // Con el botón flotante, deja lugar para no taparle la última fila.
                padding: EdgeInsets.only(top: 4, bottom: canCreate ? 88 : 24),
                itemCount: 1 + (content.isNotEmpty ? content.length : rows.length),
                itemBuilder: (_, i) {
                  if (i == 0) return _header(context, view, rows.length, page, truncated);
                  if (content.isNotEmpty) {
                    return Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: content[i - 1]);
                  }
                  final row = rows[i - 1];
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: SaleTile(
                      row: row,
                      onTap: () => context.push('/admin/venta/${row.source}/${row.id}'),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Pendientes del equipo, tipo, mes, estados y avisos.
  Widget _header(BuildContext context, SalesMonthView view, int shown, SalesPage? page, bool truncated) {
    final c = context.hc;
    final month = _month;
    final loaded = page != null;
    String withCount(String label, int n) => loaded ? '$label ($n)' : label;
    final link = TextButton.styleFrom(
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.symmetric(horizontal: 8),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: PendientesEntry(),
        ),
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
        // Mes: flechas para ir mes a mes (así también se llega a otro año) y
        // "Todos los meses" para ver todo.
        SizedBox(
          height: 40,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                IconButton(
                  tooltip: 'Mes anterior',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _step(-1),
                  icon: const Icon(Icons.chevron_left_rounded),
                ),
                ChoiceChip(
                  key: const ValueKey('ventas-mes'),
                  // Tocarlo vuelve al mes actual.
                  label: Text(monthTitle(month ?? _currentMonth)),
                  selected: month != null,
                  onSelected: (_) => setState(() => _month = _currentMonth),
                ),
                IconButton(
                  tooltip: 'Mes siguiente',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => _step(1),
                  icon: const Icon(Icons.chevron_right_rounded),
                ),
                ChoiceChip(
                  label: const Text('Todos los meses'),
                  selected: month == null,
                  onSelected: (_) => setState(() => _month = null),
                ),
                if (month != null && month != _currentMonth) ...[
                  const SizedBox(width: 4),
                  TextButton(
                    style: link,
                    onPressed: () => setState(() => _month = _currentMonth),
                    child: Text('Volver a ${monthLabel(_currentMonth)}'),
                  ),
                ],
                const SizedBox(width: 8),
              ],
            ),
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
                  label: Text(withCount('Todos', view.inMonth)),
                  selected: _status.isAll,
                  onSelected: (_) => setState(() => _status = SaleStatusFilter.all),
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text(withCount('Sin cerrar', view.openCount)),
                  selected: _status.open,
                  onSelected: (_) => setState(
                    () => _status = _status.open ? SaleStatusFilter.all : SaleStatusFilter.unclosed,
                  ),
                ),
                for (final s in SaleStatus.values) ...[
                  const SizedBox(width: 8),
                  ChoiceChip(
                    key: _statusKeys[s.api],
                    avatar: Icon(s.icon, size: 15, color: s.color),
                    label: Text(withCount(s.label, view.counts[s] ?? 0)),
                    selected: _status.status == s,
                    onSelected: (_) => setState(
                      () => _status = _status.status == s ? SaleStatusFilter.all : SaleStatusFilter.only(s),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (view.overdue > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: AdminCard(
              accent: Brand.warning,
              padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(overdueLabel(view.overdue), style: const TextStyle(fontSize: 13, height: 1.3)),
                  ),
                  TextButton(onPressed: _showOverdue, child: const Text('Ver')),
                ],
              ),
            ),
          ),
        if (truncated)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            child: Text(
              'Hay ${page!.total} ventas y se cargaron las ${page.items.length} más nuevas: los meses más viejos '
              'y los contadores pueden estar incompletos. Para llegar a una vieja, buscala o elegí un estado.',
              style: TextStyle(fontSize: 12, color: c.textFaint, height: 1.35),
            ),
          ),
        if (loaded)
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 16, 2),
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 4, 8),
                  child: Text(
                    // Sin repetir el mes: ya está marcado en la fila de arriba.
                    '$shown ${shown == 1 ? 'venta' : 'ventas'}',
                    style: TextStyle(fontSize: 12, color: c.textFaint),
                  ),
                ),
                // Buscar a alguien y que "no esté" porque compró otro mes sería
                // una trampa: se avisa y se ofrece verlas.
                if (_q.isNotEmpty && month != null && view.inOtherMonths > 0)
                  TextButton(
                    style: link,
                    onPressed: () => setState(() => _month = null),
                    child: Text('+${view.inOtherMonths} en otros meses · Ver'),
                  ),
              ],
            ),
          )
        else
          const SizedBox(height: 10),
      ],
    );
  }
}
