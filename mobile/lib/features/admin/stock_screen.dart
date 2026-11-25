import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import 'admin_models.dart';
import 'admin_providers.dart';
import 'admin_widgets.dart';
import 'filamentos/filamento_detail_screen.dart';
import 'filamentos/filament_type_picker.dart';
import 'filamentos/filamento_form_screen.dart';
import 'filamentos/filamentos_format.dart';
import 'filamentos/movements_screen.dart';
import 'filamentos/report_sheet.dart';
import 'filamentos/shared_widgets.dart' show showToast;

/// "#C9A84C" → Color. Si el hex viene roto, un gris neutro (nunca rompe).
Color hexColor(String? hex, {Color fallback = const Color(0xFF8D8C99)}) {
  final h = (hex ?? '').replaceFirst('#', '').trim();
  if (h.length != 6) return fallback;
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

/// Un carrete: color real, material, stock y barra contra el carrete completo.
/// Con [onTap] se puede tocar (abre el detalle en Filamentos); sin él, es
/// solo informativo (así lo usa el inicio).
class FilamentTile extends StatelessWidget {
  const FilamentTile({super.key, required this.f, this.onTap});
  final FilamentStock f;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final swatch = hexColor(f.hex);
    final statusColor = f.isOut ? Brand.danger : (f.isLow ? Brand.warning : Brand.success);
    final statusText = f.isOut ? 'Agotado' : (f.isLow ? 'Stock bajo' : 'OK');
    final full = f.spoolGrams > 0 ? f.spoolGrams : (f.stockGrams > 0 ? f.stockGrams : 1000);
    final progress = (f.stockGrams / full).clamp(0.0, 1.0);
    final mark = (f.alertThresholdGrams / full).clamp(0.0, 1.0);

    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: swatch,
                  border: Border.all(color: c.border, width: 1.5),
                ),
                child: Center(
                  child: Container(
                    width: 13,
                    height: 13,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: c.bg),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${f.material} · ${f.color}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                    ),
                    Text(
                      [f.brand, if (f.diameter.isNotEmpty) '${f.diameter} mm']
                          .where((e) => e.isNotEmpty)
                          .join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: c.textDim),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatGrams(f.stockGrams),
                    style: const TextStyle(
                      fontFamily: 'Orbitron',
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (_, box) => Stack(
              clipBehavior: Clip.none,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 7,
                    backgroundColor: c.surface3,
                    valueColor: AlwaysStoppedAnimation(statusColor),
                  ),
                ),
                // Marca del umbral de alerta.
                Positioned(
                  left: (box.maxWidth * mark).clamp(0.0, box.maxWidth - 2),
                  top: -2,
                  child: Container(width: 2, height: 11, color: c.textFaint),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          // Flexible + elipsis: con fuente grande o carretes de varios kg no se
          // desborda (las dos mitades se reparten el ancho).
          Row(
            children: [
              Flexible(
                child: Text(
                  'Alerta en ${formatGrams(f.alertThresholdGrams)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: c.textFaint),
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  'Carrete ${formatGrams(f.spoolGrams)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: 11, color: c.textFaint),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Gestión de filamentos: stock con alertas de bajo / agotado, alta, edición,
/// baja, ajuste de stock con historial, informe y plantilla de colores.
/// Se abre desde "Más" → Filamentos, sobre la barra del panel (hasta el
/// 2026-11-17 era la tercera pestaña; ese lugar lo ocupa la cola).
class AdminStockScreen extends ConsumerStatefulWidget {
  const AdminStockScreen({super.key});

  @override
  ConsumerState<AdminStockScreen> createState() => _AdminStockScreenState();
}

class _AdminStockScreenState extends ConsumerState<AdminStockScreen> {
  String _filter = 'all'; // all | alerts
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(adminStockProvider);
    await ref.read(adminStockProvider.future).catchError((_) => StockPage(items: [], low: 0, out: 0));
  }

  // Las subpantallas van sobre el navegador raíz: a pantalla completa (sin la
  // barra inferior del panel), igual que el detalle de una venta.
  Future<T?> _push<T>(Widget screen) =>
      Navigator.of(context, rootNavigator: true).push<T>(MaterialPageRoute(builder: (_) => screen));

  Future<void> _open(FilamentStock f) => _push<void>(FilamentoDetailScreen(id: f.id));

  Future<void> _add() async {
    final saved = await _push<bool>(const FilamentoFormScreen());
    if (saved == true && mounted) showToast(context, 'Filamento agregado');
  }

  Future<void> _copyColors(List<FilamentStock> items) async {
    final text = colorsTemplate([for (final f in items) (color: f.color, stockGrams: f.stockGrams)]);
    await Clipboard.setData(ClipboardData(text: text));
    if (mounted) showToast(context, 'Plantilla de colores copiada');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final stock = ref.watch(adminStockProvider);

    if (me != null && !me.can('filamentos', 'ver')) {
      return Scaffold(
        appBar: AppBar(title: const Text('Filamentos')),
        body: const AccessDenied(what: 'el stock de filamentos'),
      );
    }
    final canCreate = me?.can('filamentos', 'crear') ?? false;

    return Scaffold(
      // Barra de módulo: título y flecha de volver a "Más" (la pone sola).
      appBar: AppBar(
        title: const Text('Filamentos'),
        actions: [
          IconButton(
            tooltip: 'Historial de movimientos',
            icon: const Icon(Icons.history_rounded),
            onPressed: () => _push<void>(const FilamentMovementsScreen()),
          ),
          PopupMenuButton<String>(
            tooltip: 'Más opciones',
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (v) {
              if (v == 'report') {
                showStockReportSheet(Navigator.of(context, rootNavigator: true).context);
              }
              if (v == 'types') openFilamentTypes(context);
              if (v == 'colors') _copyColors(stock.value?.items ?? const []);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'types', child: Text('Tipos y precios')),
              PopupMenuItem(value: 'report', child: Text('Informe de stock')),
              PopupMenuItem(value: 'colors', child: Text('Copiar colores en stock')),
            ],
          ),
        ],
      ),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              heroTag: 'nuevo-filamento',
              onPressed: _add,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Agregar'),
            )
          : null,
      body: stock.when(
        loading: () => const ListSkeleton(rows: 6, height: 104),
        error: (e, _) => ErrorView(message: '$e', onRetry: () => ref.invalidate(adminStockProvider)),
        data: (page) {
          final q = _search.text.trim().toLowerCase();
          var items = page.items;
          if (_filter == 'alerts') items = items.where((f) => f.isLow || f.isOut).toList();
          if (q.isNotEmpty) {
            items = items
                .where((f) => '${f.material} ${f.color} ${f.brand}'.toLowerCase().contains(q))
                .toList();
          }
          // Primero lo más urgente: agotados, bajos y recién después los OK.
          int rank(FilamentStock f) => f.isOut ? 0 : (f.isLow ? 1 : 2);
          items = [...items]..sort((a, b) {
              final r = rank(a).compareTo(rank(b));
              return r != 0 ? r : a.stockGrams.compareTo(b.stockGrams);
            });
          final totalGrams = page.items.fold<double>(0, (a, f) => a + (f.stockGrams > 0 ? f.stockGrams : 0));

          return RefreshIndicator(
            color: Brand.gold,
            onRefresh: _refresh,
            child: ListView(
              // 96 = lugar para el botón flotante; más la barra del sistema
              // (la pantalla ya no está dentro de la barra del panel).
              padding: EdgeInsets.fromLTRB(16, 4, 16, 96 + MediaQuery.paddingOf(context).bottom),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _Counter(
                        label: 'Carretes',
                        value: '${page.items.length}',
                        color: Brand.info,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Counter(label: 'Stock bajo', value: '${page.low}', color: Brand.warning),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Counter(label: 'Agotados', value: '${page.out}', color: Brand.danger),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    '${formatGrams(totalGrams)} de filamento en stock',
                    style: TextStyle(fontSize: 12, color: c.textFaint),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Buscar material, color o marca…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () => setState(_search.clear),
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Todos'),
                      selected: _filter == 'all',
                      onSelected: (_) => setState(() => _filter = 'all'),
                    ),
                    ChoiceChip(
                      label: Text('Con alerta (${page.low + page.out})'),
                      selected: _filter == 'alerts',
                      onSelected: (_) => setState(() => _filter = 'alerts'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (page.items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: EmptyView(
                      icon: Icons.donut_large_outlined,
                      title: 'Todavía no cargaste filamentos',
                      subtitle: canCreate
                          ? 'Tocá «Agregar» para cargar tu primer carrete.'
                          : 'Cuando se cargue stock va a aparecer acá.',
                    ),
                  )
                else if (items.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: EmptyView(
                      icon: _filter == 'alerts' ? Icons.verified_rounded : Icons.search_off_rounded,
                      title: _filter == 'alerts' ? '¡Todo el stock está bien!' : 'Sin resultados',
                      subtitle: _filter == 'alerts'
                          ? 'Ningún filamento está bajo ni agotado.'
                          : 'Probá con otra búsqueda.',
                    ),
                  )
                else
                  for (final f in items) ...[
                    FilamentTile(f: f, onTap: () => _open(f)),
                    const SizedBox(height: 10),
                  ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return AdminCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      accent: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: TextStyle(
              fontFamily: 'Orbitron',
              fontWeight: FontWeight.w800,
              fontSize: 22,
              color: color,
            ),
          ),
          // Una sola línea: con letra grande "Agotados" se partía en dos
          // ("Agotado" / "s"); si no entra, se achica.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              label,
              maxLines: 1,
              softWrap: false,
              style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
