import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/modals.dart';
import '../admin_widgets.dart';
import 'ventas_extra_api.dart';
import 'ventas_extra_models.dart';
import 'ventas_extra_widgets.dart';

/// Elegir productos del catálogo (el "Cargar desde un producto de la tienda"
/// de la web). La pantalla queda abierta para sumar varios; cada uno que se
/// confirma se agrega a la venta con [onAdd].
class CatalogPickerScreen extends ConsumerStatefulWidget {
  const CatalogPickerScreen({super.key, required this.onAdd});

  /// Recibe la línea y la categoría del producto (para sugerir la de la venta).
  final void Function(SaleDraftLine line, String? category) onAdd;

  @override
  ConsumerState<CatalogPickerScreen> createState() => _CatalogPickerScreenState();
}

class _CatalogPickerScreenState extends ConsumerState<CatalogPickerScreen> {
  final _ctl = TextEditingController();
  Timer? _debounce;
  String _q = '';
  int _added = 0;

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

  Future<void> _pick(SaleCatalogProduct p) async {
    final line = await showAppSheet<SaleDraftLine>(
      context,
      builder: (_) => ProductOptionSheet(product: p),
    );
    if (line == null || !mounted) return;
    widget.onAdd(line, p.categoryName);
    setState(() => _added++);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text('Agregado: ${line.name}'),
        duration: const Duration(milliseconds: 1400),
      ));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final page = ref.watch(saleCatalogProvider(_q));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Elegir producto'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(_added == 0 ? 'Cerrar' : 'Listo ($_added)'),
          ),
          const SizedBox(width: 8),
        ],
      ),
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
                onRetry: () => ref.invalidate(saleCatalogProvider(_q)),
              ),
              data: (data) => data.items.isEmpty
                  ? EmptyView(
                      icon: Icons.search_off_rounded,
                      title: 'No encontramos productos',
                      subtitle: _q.isEmpty
                          ? 'Todavía no hay productos cargados en la tienda.'
                          : 'Probá con otra palabra, o cargalo como texto libre.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
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
  final SaleCatalogProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final r = product.priceRange;
    final price = r.min == r.max ? formatPrice(r.min) : 'desde ${formatPrice(r.min)}';
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
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: [
                      if (product.categoryName != null)
                        TextTag(product.categoryName!, icon: Icons.sell_outlined),
                      if (product.variants.isNotEmpty)
                        TextTag('${product.variants.length} opciones', icon: Icons.tune_rounded),
                      if (product.noneHasStock) const _WarnTag('Sin carrete'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            // El precio ocupa como mucho el 40 % del ancho: si es muy largo (9
            // cifras, letra grande) se achica en vez de dejar sin lugar al
            // nombre y a las etiquetas.
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: box.maxWidth * 0.4),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  price,
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

class _WarnTag extends StatelessWidget {
  const _WarnTag(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: Brand.warning.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.warning_amber_rounded, size: 12, color: Brand.warning),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: Brand.warning, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
}

/// Hoja para elegir tamaño, color, cantidad y precio de un producto.
class ProductOptionSheet extends StatefulWidget {
  const ProductOptionSheet({super.key, required this.product});
  final SaleCatalogProduct product;

  @override
  State<ProductOptionSheet> createState() => _ProductOptionSheetState();
}

class _ProductOptionSheetState extends State<ProductOptionSheet> {
  late String? _variant = widget.product.defaultVariant;
  late String? _color = widget.product.defaultColor;
  int _qty = 1;
  bool _priceEdited = false;
  String? _priceError;
  final _priceKey = GlobalKey();
  late final TextEditingController _price = TextEditingController(
    text: moneyText(_option?.unitPrice ?? widget.product.price),
  );

  SaleCatalogOption? get _option => widget.product.optionFor(_variant, _color);

  @override
  void dispose() {
    _price.dispose();
    super.dispose();
  }

  void _select({String? variant, String? color, bool setVariant = false, bool setColor = false}) {
    setState(() {
      if (setVariant) _variant = variant;
      if (setColor) _color = color;
      // Si el dueño no tocó el precio, sigue al de la tienda para esa elección.
      if (!_priceEdited) {
        _price.text = moneyText(_option?.unitPrice ?? widget.product.price);
      }
    });
  }

  void _add() {
    final price = parseMoney(_price.text);
    if (price == null) {
      setState(() => _priceError = 'Poné el precio.');
      // Con muchos tamaños y colores el campo puede haber quedado fuera de la
      // vista: se lo muestra, así se ve qué falta.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final field = _priceKey.currentContext;
        if (field != null) {
          Scrollable.ensureVisible(field, alignment: 0.5, duration: const Duration(milliseconds: 200));
        }
      });
      return;
    }
    final p = widget.product;
    final opt = _option;
    final hex = _color == null
        ? null
        : p.colors.where((e) => e.name == _color).map((e) => e.hex).firstOrNull;
    Navigator.of(context).pop(SaleDraftLine(
      uid: nextDraftUid(),
      productId: p.id,
      name: p.name,
      variantLabel: _variant,
      color: _color,
      colorHex: hex,
      quantity: _qty,
      unitPrice: price,
      catalogPrice: opt?.unitPrice ?? p.price,
      hasStock: opt?.hasStock ?? false,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final p = widget.product;
    final opt = _option;
    final price = parseMoney(_price.text) ?? 0;
    final storePrice = opt?.unitPrice ?? p.price;
    final label = TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w700);

    // Hoja estándar: con muchos tamaños y colores el contenido se desplaza y
    // "Agregar" queda fijo, arriba del teclado y de la barra del sistema.
    return SheetBody(
      title: p.name,
      footer: GoldButton(
        label: 'Agregar · ${formatPrice(price * _qty)}',
        icon: Icons.add_shopping_cart_rounded,
        onPressed: _add,
      ),
      children: [
        if (p.categoryName != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: TextTag(p.categoryName!, icon: Icons.sell_outlined),
          ),
        if (p.variants.isNotEmpty) ...[
          Text(
            p.variants.any((v) => v.contains(' + ')) ? '¿Qué combinación?' : '¿Qué tamaño?',
            style: label,
          ),
          const SizedBox(height: 8),
          _ChipWrap(
            builder: (labelWidth) => [
              for (final v in p.variants)
                ChoiceChip(
                  // Una combinación multicolor puede ser muy larga ("Blanco +
                  // Celeste + Dorado + …"): baja de renglón en vez de cortarse,
                  // así dos combinaciones parecidas se pueden distinguir.
                  label: _chipLabel(v, labelWidth, maxLines: 3),
                  selected: _variant == v,
                  onSelected: (_) => _select(variant: v, setVariant: true),
                ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        if (!p.isMulti && p.colors.isNotEmpty) ...[
          Text('¿De qué color?', style: label),
          const SizedBox(height: 8),
          _ChipWrap(
            builder: (labelWidth) => [
              for (final col in p.colors)
                ChoiceChip(
                  avatar: ColorDot(col.hex, size: 16),
                  label: _chipLabel(col.name, labelWidth, maxLines: 2),
                  selected: _color == col.name,
                  // Sin tilde: se dibuja ENCIMA del círculo y tapa el color
                  // elegido (el blanco se veía gris). El fondo dorado alcanza.
                  showCheckmark: false,
                  onSelected: (_) => _select(color: col.name, setColor: true),
                ),
            ],
          ),
          const SizedBox(height: 18),
        ],
        Row(
          children: [
            Text('Cantidad', style: label),
            const Spacer(),
            QtyStepper(value: _qty, onChanged: (v) => setState(() => _qty = v)),
          ],
        ),
        const SizedBox(height: 14),
        MoneyField(
          key: _priceKey,
          controller: _price,
          label: 'Precio c/u',
          errorText: _priceError,
          helperText: price == storePrice
              ? 'Es el precio de la tienda para esta elección.'
              : 'Precio de la tienda: ${formatPrice(storePrice)}',
          onChanged: (_) => setState(() {
            _priceEdited = true;
            _priceError = null;
          }),
        ),
        if (opt != null) ...[
          const SizedBox(height: 12),
          _StockNote(hasStock: opt.hasStock, grams: opt.weightGrams),
        ],
      ],
    );
  }
}

/// Rótulo de un chip que puede ocupar más de un renglón. El ancho se fija a
/// mano ([maxWidth]): el chip mide su rótulo dos veces con anchos distintos y,
/// sin esto, un texto que baja de renglón perdía la última línea.
Widget _chipLabel(String text, double maxWidth, {required int maxLines}) => ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: Text(text, softWrap: true, maxLines: maxLines, overflow: TextOverflow.ellipsis),
    );

/// Chips de elección que bajan de renglón. Le pasa a [builder] el ancho que
/// puede ocupar el rótulo de cada chip (el de la hoja menos los márgenes, el
/// círculo de color y la tilde del chip).
class _ChipWrap extends StatelessWidget {
  const _ChipWrap({required this.builder});
  final List<Widget> Function(double labelWidth) builder;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, box) => Wrap(
          spacing: 8,
          runSpacing: 8,
          children: builder((box.maxWidth - 76).clamp(80.0, double.infinity)),
        ),
      );
}

class _StockNote extends StatelessWidget {
  const _StockNote({required this.hasStock, required this.grams});
  final bool hasStock;
  final double grams;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final color = hasStock ? Brand.success : Brand.warning;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          hasStock ? Icons.check_circle_outline_rounded : Icons.warning_amber_rounded,
          size: 18,
          color: color,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            hasStock
                ? 'Descuenta${grams > 0 ? ' ${moneyText(grams)} g' : ''} del carrete cuando se confirma el pago, y el costo sale del filamento.'
                : 'Sin carrete ni gramos cargados: no descuenta stock. Vas a cargar el costo a mano.',
            style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
          ),
        ),
      ],
    );
  }
}

/// Hoja para cargar una línea de texto libre (algo que no está en el catálogo).
class FreeLineSheet extends StatefulWidget {
  const FreeLineSheet({super.key});

  @override
  State<FreeLineSheet> createState() => _FreeLineSheetState();
}

class _FreeLineSheetState extends State<FreeLineSheet> {
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _cost = TextEditingController();
  int _qty = 1;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    _cost.dispose();
    super.dispose();
  }

  void _add() {
    final name = _name.text.trim();
    final price = parseMoney(_price.text);
    final cost = parseMoney(_cost.text);
    final problem = name.isEmpty
        ? 'Poné qué se vendió.'
        : price == null
            ? 'Poné el precio.'
            : cost == null
                ? 'Poné el costo (0 si no tuvo).'
                : null;
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    Navigator.of(context).pop(SaleDraftLine(
      uid: nextDraftUid(),
      name: name,
      quantity: _qty,
      unitPrice: price,
      unitCost: cost,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final price = parseMoney(_price.text) ?? 0;
    return SheetBody(
      title: 'Texto libre',
      subtitle: 'Para algo que no está en el catálogo. No descuenta filamento.',
      footer: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // El aviso va fijo junto al botón: con el teclado abierto, dentro
          // del contenido quedaba fuera de la vista.
          if (_error != null) ...[
            InlineError(_error!),
            const SizedBox(height: 10),
          ],
          GoldButton(
            label: 'Agregar · ${formatPrice(price * _qty)}',
            icon: Icons.add_rounded,
            onPressed: _add,
          ),
        ],
      ),
      children: [
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.sentences,
          maxLength: 160,
          onChanged: (_) => setState(() => _error = null),
          decoration: const InputDecoration(
            labelText: 'Qué se vendió',
            counterText: '',
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Text(
              'Cantidad',
              style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w700),
            ),
            const Spacer(),
            QtyStepper(value: _qty, onChanged: (v) => setState(() => _qty = v)),
          ],
        ),
        const SizedBox(height: 12),
        MoneyField(
          controller: _price,
          label: 'Precio c/u',
          onChanged: (_) => setState(() => _error = null),
        ),
        const SizedBox(height: 12),
        MoneyField(
          controller: _cost,
          label: 'Costo c/u',
          helperText: 'Lo que te costó hacerlo o comprarlo. Poné 0 si no tuvo costo.',
          onChanged: (_) => setState(() => _error = null),
        ),
      ],
    );
  }
}
