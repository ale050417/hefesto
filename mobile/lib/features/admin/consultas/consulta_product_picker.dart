import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import '../ventas_extra/ventas_extra_widgets.dart' show TextTag;
import 'consultas_api.dart';
import 'consultas_models.dart';

/// Lo elegido: el producto y su tamaño (o su única opción).
typedef ConsultaProductPick = ({ConsultaProduct product, ConsultaProductOption option});

/// Elegir un producto ya cargado en la tienda para rellenar la respuesta de
/// una consulta (sugerencia de Agustín, 2026-11-19; igual que la web). Se
/// cierra devolviendo el producto y el tamaño elegidos.
class ConsultaProductPickerScreen extends ConsumerStatefulWidget {
  const ConsultaProductPickerScreen({super.key});

  @override
  ConsumerState<ConsultaProductPickerScreen> createState() => _ConsultaProductPickerScreenState();
}

class _ConsultaProductPickerScreenState extends ConsumerState<ConsultaProductPickerScreen> {
  final _ctl = TextEditingController();
  Timer? _debounce;
  String _q = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _ctl.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (mounted) setState(() => _q = v.trim());
    });
    setState(() {}); // refresca el botón de limpiar
  }

  Future<void> _pick(ConsultaProduct p) async {
    FocusManager.instance.primaryFocus?.unfocus();
    var option = p.options.first;
    if (p.options.length > 1) {
      final chosen = await showAppSheet<ConsultaProductOption>(
        context,
        builder: (_) => _OptionSheet(product: p),
      );
      if (chosen == null) return;
      option = chosen;
    }
    if (mounted) Navigator.of(context).pop<ConsultaProductPick>((product: p, option: option));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final page = ref.watch(consultaProductsProvider(_q));
    return Scaffold(
      appBar: AppBar(title: const Text('Elegir producto')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              controller: _ctl,
              onChanged: _onSearch,
              textInputAction: TextInputAction.search,
              // El servidor acepta búsquedas de hasta 80 caracteres.
              inputFormatters: [LengthLimitingTextInputFormatter(80)],
              decoration: InputDecoration(
                hintText: 'Buscar producto o categoría…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _ctl.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _ctl.clear();
                          _debounce?.cancel();
                          setState(() => _q = '');
                        },
                      ),
              ),
            ),
          ),
          Expanded(
            child: page.when(
              loading: () => const ListSkeleton(rows: 6, height: 74),
              error: (e, _) => ErrorView(
                message: '$e',
                onRetry: () => ref.invalidate(consultaProductsProvider(_q)),
              ),
              data: (data) => data.items.isEmpty
                  ? EmptyView(
                      icon: Icons.search_off_rounded,
                      title: 'No encontramos productos',
                      subtitle: _q.isEmpty
                          ? 'Todavía no hay productos cargados en la tienda.'
                          : 'Probá con otra palabra, o respondé con la calculadora.',
                    )
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(16, 4, 16, 24 + MediaQuery.paddingOf(context).bottom),
                      itemCount: data.items.length + 1,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (_, i) {
                        if (i == data.items.length) {
                          return Padding(
                            padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
                            child: Text(
                              data.total > data.items.length
                                  ? 'Mostrando ${data.items.length} de ${data.total}. Escribí arriba para afinar la búsqueda.'
                                  : '${data.total} ${data.total == 1 ? 'producto' : 'productos'}',
                              style: TextStyle(fontSize: 12, color: c.textFaint),
                            ),
                          );
                        }
                        final p = data.items[i];
                        return _ProductTile(product: p, onTap: () => _pick(p));
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({required this.product, required this.onTap});
  final ConsultaProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final prices = product.options.map((o) => o.unitPrice);
    final min = prices.reduce((a, b) => a < b ? a : b);
    final max = prices.reduce((a, b) => a > b ? a : b);
    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: LayoutBuilder(
        builder: (context, box) => Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5),
                  ),
                  if (product.categoryName != null || product.options.length > 1) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (product.categoryName != null)
                          TextTag(product.categoryName!, icon: Icons.sell_outlined),
                        if (product.options.length > 1)
                          TextTag('${product.options.length} opciones', icon: Icons.tune_rounded),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Como mucho el 40 % del ancho: un precio largo se achica en vez
            // de dejar sin lugar al nombre.
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: box.maxWidth * 0.4),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  min == max ? formatPrice(min) : 'desde ${formatPrice(min)}',
                  style: const TextStyle(
                    fontFamily: 'Orbitron',
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: Brand.gold,
                  ),
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.textFaint),
          ],
        ),
      ),
    );
  }
}

/// Qué tamaño / combinación del producto se cotiza.
class _OptionSheet extends StatelessWidget {
  const _OptionSheet({required this.product});
  final ConsultaProduct product;

  @override
  Widget build(BuildContext context) {
    return SheetBody(
      title: product.name,
      subtitle: '¿Cuál se cotiza?',
      children: [
        for (final o in product.options)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: AdminCard(
              onTap: () => Navigator.of(context).pop(o),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      o.label ?? product.name,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    formatPrice(o.unitPrice),
                    style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.gold),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
