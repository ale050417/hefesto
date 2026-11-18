import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/config.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/product_card.dart';
import '../favorites/favorites_controller.dart';
import 'pricing.dart';

final productDetailProvider = FutureProvider.autoDispose
    .family<({ProductDetail product, List<Product> related}), String>(
  (ref, slug) => ref.watch(apiClientProvider).product(slug),
);

class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.slug, this.heroTag});
  final String slug;

  /// Etiqueta de la tarjeta desde la que se llegó (anima la foto). Null si se
  /// abrió por otro camino: en ese caso no hay animación.
  final String? heroTag;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(productDetailProvider(slug));
    return Scaffold(
      body: async.when(
        loading: () => Stack(children: [const LoadingView(), _BackButton()]),
        error: (e, _) => Stack(children: [
          ErrorView(
            message: e is ApiException ? e.message : 'No pudimos cargar el producto.',
            onRetry: () => ref.invalidate(productDetailProvider(slug)),
          ),
          _BackButton(),
        ]),
        data: (d) => _ProductBody(detail: d.product, related: d.related, heroTag: heroTag),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: _RoundButton(
            icon: Icons.arrow_back_rounded,
            onTap: () => context.canPop() ? context.pop() : context.go('/'),
          ),
        ),
      );
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.onTap, this.color});
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Material(
      color: c.surface1.withValues(alpha: 0.92),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, size: 22, color: color ?? c.text),
        ),
      ),
    );
  }
}

class _ProductBody extends ConsumerStatefulWidget {
  const _ProductBody({required this.detail, required this.related, this.heroTag});
  final ProductDetail detail;
  final List<Product> related;
  final String? heroTag;

  @override
  ConsumerState<_ProductBody> createState() => _ProductBodyState();
}

class _ProductBodyState extends ConsumerState<_ProductBody> {
  final _gallery = PageController();
  int _imageIndex = 0;
  ProductVariant? _variant;
  String? _color;

  ProductDetail get d => widget.detail;
  bool get _hasColors => d.colorMode == 'single' && d.colors.isNotEmpty;

  @override
  void initState() {
    super.initState();
    // Un solo tamaño/color → viene elegido; si hay varios, el cliente elige.
    if (d.variants.length == 1) _variant = d.variants.first;
    if (_hasColors && d.colors.length == 1) _color = d.colors.first;
  }

  @override
  void dispose() {
    _gallery.dispose();
    super.dispose();
  }

  List<ProductImage> get _images => d.images.isNotEmpty
      ? d.images
      : [if (d.base.primaryImage != null) d.base.primaryImage!];

  double get _unitPrice => saleUnitPrice(
        basePrice: effectiveBase(d),
        colorMode: d.colorMode,
        productColorPrices: d.colorPrices,
        variant: _variant,
        color: _color,
      );

  bool get _needsSize => d.variants.length > 1 && _variant == null;
  bool get _needsColor => _hasColors && d.colors.length > 1 && _color == null;
  bool get _missingChoice => _needsSize || _needsColor;

  /// Qué falta elegir, dicho con precisión (antes decía "tamaño y color"
  /// aunque el producto tuviera una sola de las dos opciones).
  String get _missingLabel {
    if (_needsSize && _needsColor) return 'Elegí tamaño y color';
    return _needsSize ? 'Elegí un tamaño' : 'Elegí un color';
  }

  void _pickColor(String color) {
    setState(() => _color = _color == color ? null : color);
    // La galería salta a la foto de ese color (si la tiene).
    final i = _images.indexWhere((img) => img.color == color);
    if (i >= 0 && _color == color) {
      _gallery.animateToPage(i,
          duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
  }

  Future<void> _consult(BrandInfo? brand) async {
    final url = '${AppConfig.siteUrl}/producto/${d.base.slug}';
    final extras = [
      if (_variant != null && d.variants.length > 1) _variant!.label,
      if (_color != null) 'color $_color' else if (d.base.lineColor != null) 'color ${d.base.lineColor}',
    ];
    final message = '¡Hola! Quería consultar por "${d.base.name}"'
        '${extras.isEmpty ? '' : ' (${extras.join(', ')})'}'
        ' — ${formatPrice(_unitPrice)}.\n$url';
    final ok = await openWhatsapp(brand?.whatsapp, message);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No pudimos abrir WhatsApp.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final brand = ref.watch(homeProvider).value?.brand;
    final fav = ref.watch(favoritesProvider).any((p) => p.id == d.base.id);
    final images = _images;
    final onSale = d.base.saleApplies && _unitPrice == effectiveBase(d);

    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (images.isEmpty)
                      const NetImage(null)
                    else
                      PageView.builder(
                        controller: _gallery,
                        itemCount: images.length,
                        onPageChanged: (i) => setState(() => _imageIndex = i),
                        itemBuilder: (_, i) {
                          final img = NetImage(images[i].url, position: images[i].position);
                          final tag = widget.heroTag;
                          return i == 0 && tag != null ? Hero(tag: tag, child: img) : img;
                        },
                      ),
                    if (images.length > 1)
                      Positioned(
                        bottom: 14,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            for (var i = 0; i < images.length; i++)
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 220),
                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                width: i == _imageIndex ? 20 : 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  color: i == _imageIndex
                                      ? Brand.gold
                                      : Colors.white.withValues(alpha: 0.7),
                                  borderRadius: BorderRadius.circular(99),
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (d.base.category != null)
                      Text(
                        d.base.category!.name.toUpperCase(),
                        style: const TextStyle(
                          fontFamily: 'Orbitron',
                          fontSize: 10.5,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700,
                          color: Brand.gold,
                        ),
                      ),
                    const SizedBox(height: 6),
                    Text(d.base.name, style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 14),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          formatPrice(_unitPrice),
                          style: const TextStyle(
                            fontFamily: 'Orbitron',
                            fontWeight: FontWeight.w800,
                            fontSize: 28,
                            color: Brand.gold,
                          ),
                        ),
                        if (onSale) ...[
                          const SizedBox(width: 10),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 5),
                            child: Text(
                              formatPrice(d.base.price),
                              style: TextStyle(
                                fontSize: 15,
                                color: c.textFaint,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 5),
                            child: Text(
                              '-${d.base.discountPercent}%',
                              style: const TextStyle(
                                  color: Brand.danger, fontWeight: FontWeight.w700),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (d.variants.length > 1) ...[
                      const SizedBox(height: 22),
                      _Label('Tamaño', _variant?.label),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final v in d.variants)
                            ChoiceChip(
                              label: Text(v.label),
                              selected: _variant?.id == v.id,
                              showCheckmark: false,
                              onSelected: (_) => setState(
                                  () => _variant = _variant?.id == v.id ? null : v),
                              side: BorderSide(
                                  color: _variant?.id == v.id ? Brand.gold : c.border),
                            ),
                        ],
                      ),
                    ],
                    if (_hasColors && d.colors.length > 1) ...[
                      const SizedBox(height: 22),
                      _Label('Color', _color),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final col in d.colors)
                            ChoiceChip(
                              label: Text(col),
                              selected: _color == col,
                              showCheckmark: false,
                              onSelected: (_) => _pickColor(col),
                              side: BorderSide(
                                  color: _color == col ? Brand.gold : c.border),
                            ),
                        ],
                      ),
                    ],
                    if (d.description != null && d.description!.trim().isNotEmpty) ...[
                      const SizedBox(height: 26),
                      Text('Descripción', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 8),
                      Text(d.description!, style: Theme.of(context).textTheme.bodyLarge),
                    ],
                    const SizedBox(height: 26),
                    _Specs(d: d),
                  ],
                ),
              ),
            ),
            if (widget.related.isNotEmpty) ...[
              const SliverToBoxAdapter(
                child: SectionHeader(eyebrow: 'Te puede gustar', title: 'Productos relacionados'),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 168 + cardTextExtent(context),
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    itemCount: widget.related.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 12),
                    itemBuilder: (_, i) => ProductCard(
                      product: widget.related[i],
                      // Lleva el producto actual: al encadenar relacionados no
                      // se repite la etiqueta entre una pantalla y la siguiente.
                      section: 'relacionados-${d.base.slug}',
                      width: 168,
                    ),
                  ),
                ),
              ),
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 120)),
          ],
        ),
        // Velo arriba: al desplazar, el texto pasaba por detrás de la hora y la
        // batería (y del notch) y no se leía ni una cosa ni la otra. También
        // deja legibles los íconos del sistema sobre una foto clara.
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: MediaQuery.paddingOf(context).top + 28,
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [c.bg.withValues(alpha: 0.94), c.bg.withValues(alpha: 0.72), c.bg.withValues(alpha: 0)],
                  stops: const [0, 0.6, 1],
                ),
              ),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                _RoundButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.canPop() ? context.pop() : context.go('/'),
                ),
                const Spacer(),
                _RoundButton(
                  icon: Icons.share_rounded,
                  onTap: () => shareProductOnWhatsapp(
                    context,
                    name: d.base.name,
                    link: '${AppConfig.siteUrl}/producto/${d.base.slug}',
                    price: formatPrice(_unitPrice),
                  ),
                ),
                const SizedBox(width: 8),
                _RoundButton(
                  icon: fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                  color: fav ? Brand.danger : null,
                  onTap: () => ref.read(favoritesProvider.notifier).toggle(d.base),
                ),
              ],
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            padding: EdgeInsets.fromLTRB(
                20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
            decoration: BoxDecoration(
              color: c.surface1,
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: GoldButton(
              icon: Icons.chat_rounded,
              label: _missingChoice ? _missingLabel : 'Consultar por WhatsApp',
              onPressed: _missingChoice ? null : () => _consult(brand),
            ),
          ),
        ),
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.title, this.value);
  final String title;
  final String? value;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall),
          if (value != null) ...[
            const SizedBox(width: 8),
            // Hay tamaños con nombres de 45 letras ("3 x 4 pulgadas
            // (aproximadamente…)"): sin esto la fila se salía de la pantalla.
            Flexible(
              child: Text(
                value!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ],
      );
}

class _Specs extends StatelessWidget {
  const _Specs({required this.d});
  final ProductDetail d;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final rows = <(IconData, String, String)>[
      if (d.base.material != null) (Icons.layers_rounded, 'Material', d.base.material!),
      if (d.productionTime != null) (Icons.schedule_rounded, 'Producción', d.productionTime!),
      if (d.dimensions != null) (Icons.straighten_rounded, 'Dimensiones', d.dimensions!),
      if (d.weightGrams != null) (Icons.scale_rounded, 'Peso', '${d.weightGrams} g'),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return Container(
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.border),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) Divider(height: 1, color: c.border),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              child: Row(
                children: [
                  Icon(rows[i].$1, size: 19, color: Brand.gold),
                  const SizedBox(width: 12),
                  Text(rows[i].$2, style: TextStyle(color: c.textDim, fontSize: 13)),
                  const Spacer(),
                  Flexible(
                    child: Text(
                      rows[i].$3,
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5),
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
