import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/favorites/favorites_controller.dart';
import '../api/models.dart';
import '../format.dart';
import '../theme/app_theme.dart';
import 'common.dart';

/// Alto del bloque de texto de la tarjeta (categoría + nombre de 2 líneas +
/// precio + márgenes) con la letra en tamaño normal.
const double kCardTextExtent = 112;

/// Cuánto se agrandó la letra del sistema (1 = normal; la app la limita a 1,3).
double _textScale(BuildContext context) => MediaQuery.textScalerOf(context).scale(100) / 100;

/// Alto del bloque de texto para la letra de ESTE teléfono. El alto total de
/// la tarjeta es ancho + esto.
///
/// Antes era fijo: con la letra del sistema en "grande" la segunda línea del
/// nombre salía cortada por la mitad (2026-11-14).
double cardTextExtent(BuildContext context) =>
    kCardTextExtent + (_textScale(context) - 1).clamp(0.0, 1.0) * 76;

/// Delegado de grilla de 2 columnas con tarjetas del mismo alto, sin depender
/// de un aspect ratio (que se desbordaba con nombres largos).
SliverGridDelegate productGridDelegate(BuildContext context) {
  final width = (MediaQuery.sizeOf(context).width - 32 - 12) / 2;
  return SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    mainAxisSpacing: 12,
    crossAxisSpacing: 12,
    mainAxisExtent: width + cardTextExtent(context),
  );
}

/// Tarjeta de producto (catálogo, home, favoritos, relacionados).
class ProductCard extends ConsumerWidget {
  const ProductCard({super.key, required this.product, required this.section, this.width});
  final Product product;
  final double? width;

  /// Dónde está la tarjeta ("destacados", "catalogo", "favoritos"…). Forma
  /// parte de la etiqueta de la animación de la foto hacia el detalle.
  ///
  /// El mismo producto suele estar a la vez en el inicio, en el catálogo y en
  /// favoritos (las pestañas siguen vivas aunque no se vean). Con una etiqueta
  /// igual para todas, la foto "volaba" desde la tarjeta de OTRA pestaña, y en
  /// modo desarrollo directamente fallaba (2026-11-14).
  final String section;

  String get heroTag => 'product-$section-${product.slug}';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final fav = ref.watch(favoritesProvider).any((p) => p.id == product.id);
    final onSale = product.saleApplies && product.discountPercent != null;

    return SizedBox(
      width: width,
      child: GestureDetector(
        onTap: () => context.push('/producto/${product.slug}', extra: heroTag),
        behavior: HitTestBehavior.opaque,
        child: Container(
          decoration: BoxDecoration(
            color: c.surface1,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: c.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Hero(
                      tag: heroTag,
                      child: NetImage(
                        product.primaryImage?.url,
                        position: product.primaryImage?.position,
                      ),
                    ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Row(
                        children: [
                          if (product.isNew) const _Badge('Nuevo', gold: true),
                          if (product.isNew && onSale) const SizedBox(width: 4),
                          if (onSale) _Badge('-${product.discountPercent}%'),
                        ],
                      ),
                    ),
                    Positioned(
                      right: 6,
                      top: 6,
                      child: Material(
                        color: c.surface1.withValues(alpha: 0.9),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () =>
                              ref.read(favoritesProvider.notifier).toggle(product),
                          child: Padding(
                            padding: const EdgeInsets.all(7),
                            child: Icon(
                              fav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                              size: 19,
                              color: fav ? Brand.danger : c.textDim,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (product.category != null)
                      Text(
                        product.category!.name.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 9.5,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w600,
                          color: c.textFaint,
                        ),
                      ),
                    const SizedBox(height: 3),
                    // Alto fijo (2 líneas): todas las tarjetas miden lo mismo y
                    // nunca se desbordan, tenga el nombre 1 o 2 líneas.
                    SizedBox(
                      height: 34 * _textScale(context),
                      child: Text(
                        product.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(height: 1.25, fontSize: 12.5),
                      ),
                    ),
                    const SizedBox(height: 6),
                    // Una sola línea: si no entra ("Desde $62.500 $85.000"),
                    // se achica en vez de pasar a otra línea.
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          if (product.priceFrom) ...[
                            Text('Desde',
                                style: TextStyle(fontSize: 11, color: c.textDim)),
                            const SizedBox(width: 5),
                          ],
                          Text(
                            formatPrice(product.displayPrice),
                            style: TextStyle(
                              fontFamily: 'Orbitron',
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                              color: onSale ? Brand.gold : c.text,
                            ),
                          ),
                          if (onSale) ...[
                            const SizedBox(width: 6),
                            Text(
                              formatPrice(product.price),
                              style: TextStyle(
                                fontSize: 11.5,
                                color: c.textFaint,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text, {this.gold = false});
  final String text;
  final bool gold;

  @override
  Widget build(BuildContext context) {
    final color = gold ? Brand.gold : Brand.danger;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: context.hc.surface1.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}
