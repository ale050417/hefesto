import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_widgets.dart';
import 'catalogo_ui.dart';
import 'producto_form_screen.dart';
import 'productos_actions.dart';
import 'productos_models.dart';
import 'productos_providers.dart';

/// "300" → "5 h", "90" → "1 h 30 min", "45" → "45 min".
String formatMinutes(int minutes) {
  if (minutes < 60) return '$minutes min';
  final h = minutes ~/ 60;
  final m = minutes % 60;
  return m == 0 ? '$h h' : '$h h $m min';
}

String _grams(double g) => '${g == g.roundToDouble() ? g.round() : g.toStringAsFixed(1)} g';

/// Ficha completa de un producto: fotos, precios, datos, colores, tamaños y
/// costos (estos últimos solo con permiso de Ganancias). Desde acá se edita,
/// se publica/archiva, se destaca y se elimina.
class AdminProductDetailScreen extends ConsumerWidget {
  const AdminProductDetailScreen({super.key, required this.id, this.initialName});
  final String id;

  /// Nombre ya conocido (del listado) para el título mientras carga.
  final String? initialName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('productos', 'editar') ?? false;
    final canDelete = me?.can('productos', 'eliminar') ?? false;
    final async = ref.watch(adminProductProvider(id));
    final product = async.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(product?.name ?? initialName ?? 'Producto', maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (canEdit && product != null)
            IconButton(
              tooltip: 'Editar',
              icon: const Icon(Icons.edit_rounded),
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => AdminProductFormScreen(product: product)),
              ),
            ),
        ],
      ),
      // La app dibuja de borde a borde: sin esto el final de la ficha quedaba
      // debajo de la barra de gestos (o de los tres botones de Android).
      body: SafeArea(
        top: false,
        child: async.when(
          loading: () => const ListSkeleton(rows: 4, height: 150),
          error: (e, _) =>
              ErrorView(message: errorText(e), onRetry: () => ref.invalidate(adminProductProvider(id))),
          data: (p) => RefreshIndicator(
            color: Brand.gold,
            onRefresh: () async {
              ref.invalidate(adminProductProvider(id));
              try {
                await ref.read(adminProductProvider(id).future);
              } catch (_) {}
            },
            child: _Body(product: p, canEdit: canEdit, canDelete: canDelete),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.product, required this.canEdit, required this.canDelete});
  final AdminProductDetail product;
  final bool canEdit;
  final bool canDelete;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final p = product;
    final specs = <(String, String)>[
      ('Categoría', p.categoryPath ?? p.categoryName ?? 'Sin categoría'),
      ('Material', p.material ?? '—'),
      if (p.weightGrams != null) ('Peso', _grams(p.weightGrams!.toDouble())),
      if (p.printTimeMinutes != null) ('Tiempo de impresión', formatMinutes(p.printTimeMinutes!)),
      if (p.dimensions != null) ('Medidas', p.dimensions!),
      if (p.productionTime != null) ('Tiempo de entrega', p.productionTime!),
      if (p.layerHeight != null) ('Altura de capa', p.layerHeight!),
      if (p.infillPercent != null) ('Relleno', '${p.infillPercent}%'),
    ];

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
      children: [
        _Gallery(product: p, canEdit: canEdit),
        const SizedBox(height: 16),
        Text(p.name, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            InfoPill(label: p.status.label, icon: p.status.icon, color: p.status.color(context)),
            if (p.isFeatured)
              const InfoPill(label: 'Destacado', icon: Icons.star_rounded, color: Brand.gold),
            if (p.isOnSale && p.discountPercent != null)
              InfoPill(label: '-${p.discountPercent}%', color: Brand.danger),
            if (p.isNew) const InfoPill(label: 'Nuevo', color: Brand.info),
          ],
        ),
        const SizedBox(height: 14),
        AdminCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Precio', style: TextStyle(fontSize: 12, color: c.textDim, fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              PriceLabel(price: p.price, salePrice: p.salePrice, size: 22),
              if (p.priceFrom || p.priceMax > p.priceMin) ...[
                const SizedBox(height: 6),
                Text(
                  'Según tamaño y color se cobra entre ${formatPrice(p.priceMin)} y ${formatPrice(p.priceMax)}.',
                  style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        _Actions(product: p, canEdit: canEdit, canDelete: canDelete),
        const AdminSectionTitle('Datos'),
        AdminCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Column(children: [for (final s in specs) InfoRow(s.$1, s.$2)]),
        ),
        if (p.colors.isNotEmpty) ...[
          const AdminSectionTitle('Colores'),
          _ColorsCard(product: p),
        ],
        if (p.variants.isNotEmpty) ...[
          AdminSectionTitle('Tamaños (${p.variants.length})'),
          for (final v in p.variants) ...[
            _VariantCard(variant: v, multi: p.isMulti),
            const SizedBox(height: 8),
          ],
        ],
        if (p.costs != null) ...[
          const AdminSectionTitle('Costos'),
          AdminCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                InfoRow('Costo de producción', p.costs!.amortization == null ? '—' : formatPrice(p.costs!.amortization!)),
                InfoRow('Insumos', formatPrice(p.costs!.extrasCost)),
                InfoRow('Ganancia', p.costs!.profit == null ? '—' : formatPrice(p.costs!.profit!)),
              ],
            ),
          ),
        ],
        if (p.description != null) ...[
          const AdminSectionTitle('Descripción'),
          AdminCard(child: Text(p.description!, style: const TextStyle(fontSize: 14, height: 1.5))),
        ],
        const SizedBox(height: 18),
        Center(
          child: Text(
            'Las fotos, los colores y los tamaños se cargan desde el panel web.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11.5, color: c.textFaint),
          ),
        ),
      ],
    );
  }
}

/// Botones de la ficha: publicar / archivar / destacar / ver en la tienda /
/// eliminar, según estado y permisos.
class _Actions extends StatelessWidget {
  const _Actions({required this.product, required this.canEdit, required this.canDelete});
  final AdminProductDetail product;
  final bool canEdit;
  final bool canDelete;

  @override
  Widget build(BuildContext context) {
    final p = product;
    final buttons = <Widget>[
      if (canEdit && p.status != ProductState.published)
        GoldButton(
          label: 'Publicar',
          icon: Icons.visibility_rounded,
          expand: false,
          onPressed: () => changeProductStatus(
            context,
            id: p.id,
            name: p.name,
            target: ProductState.published,
            hasPhotos: p.images.isNotEmpty,
          ),
        ),
      if (canDelete && p.status != ProductState.archived)
        OutlinedButton.icon(
          onPressed: () => changeProductStatus(
            context,
            id: p.id,
            name: p.name,
            target: ProductState.archived,
            hasPhotos: p.images.isNotEmpty,
          ),
          icon: const Icon(Icons.inventory_2_outlined, size: 18),
          label: const Text('Archivar'),
        ),
      if (canEdit)
        OutlinedButton.icon(
          onPressed: () => toggleFeatured(context, id: p.id, value: !p.isFeatured),
          icon: Icon(p.isFeatured ? Icons.star_outline_rounded : Icons.star_rounded, size: 18),
          label: Text(p.isFeatured ? 'Quitar destacado' : 'Destacar'),
        ),
      if (p.status == ProductState.published)
        OutlinedButton.icon(
          onPressed: () => openUrl('${AppConfig.siteUrl}/producto/${p.slug}'),
          icon: const Icon(Icons.open_in_new_rounded, size: 18),
          label: const Text('Ver en la tienda'),
        ),
      if (canDelete)
        TextButton.icon(
          style: TextButton.styleFrom(foregroundColor: Brand.danger),
          onPressed: () async {
            final navigator = Navigator.of(context);
            final done = await deleteProduct(context, id: p.id, name: p.name);
            if (done) navigator.pop();
          },
          icon: const Icon(Icons.delete_outline_rounded, size: 18),
          label: const Text('Eliminar'),
        ),
    ];
    if (buttons.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: buttons);
  }
}

/// Galería de solo lectura; se puede elegir cuál de las fotos YA cargadas es la
/// portada (como en la web). Subir o cambiar fotos se hace desde el panel web.
class _Gallery extends StatefulWidget {
  const _Gallery({required this.product, required this.canEdit});
  final AdminProductDetail product;
  final bool canEdit;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  int _sel = 0;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final images = widget.product.images;
    if (images.isEmpty) {
      return Container(
        height: 190,
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border),
        ),
        alignment: Alignment.center,
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.no_photography_outlined, size: 40, color: c.textFaint),
            const SizedBox(height: 8),
            const Text('Sin fotos', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(
              'Se suben desde el panel web. Sin fotos no se puede publicar.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: c.textDim),
            ),
          ],
        ),
      );
    }
    final index = _sel.clamp(0, images.length - 1);
    final sel = images[index];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            AspectRatio(
              aspectRatio: 1.15,
              child: NetImage(sel.url, position: sel.position, radius: 20),
            ),
            if (sel.isPrimary)
              const Positioned(
                left: 10,
                top: 10,
                child: InfoPill(label: 'Portada', icon: Icons.star_rounded, color: Brand.gold),
              ),
            if (sel.color != null)
              Positioned(
                right: 10,
                bottom: 10,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: c.surface1.withValues(alpha: 0.85),
                    borderRadius: BorderRadius.circular(99),
                    border: Border.all(color: c.border),
                  ),
                  child: Text(
                    sel.color!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
          ],
        ),
        if (images.length > 1) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 62,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: images.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final img = images[i];
                final selected = i == index;
                return GestureDetector(
                  onTap: () => setState(() => _sel = i),
                  child: Container(
                    width: 62,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected ? Brand.gold : c.border,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        NetImage(img.url, position: img.position, radius: 12),
                        if (img.isPrimary)
                          const Positioned(
                            right: 3,
                            top: 3,
                            child: Icon(Icons.star_rounded, size: 16, color: Brand.gold),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
        if (widget.canEdit && !sel.isPrimary) ...[
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _busy
                ? null
                : () async {
                    setState(() => _busy = true);
                    await setPrimaryImage(
                      context,
                      productId: widget.product.id,
                      imageId: sel.id,
                    );
                    if (mounted) setState(() => _busy = false);
                  },
            icon: _busy
                ? const SizedBox.square(
                    dimension: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Brand.gold),
                  )
                : const Icon(Icons.star_outline_rounded, size: 18),
            label: const Text('Usar como portada'),
          ),
        ],
      ],
    );
  }
}

class _ColorsCard extends StatelessWidget {
  const _ColorsCard({required this.product});
  final AdminProductDetail product;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final p = product;
    final hasPrices = !p.isMulti && p.colorPrices.isNotEmpty;
    final hasGrams = p.isMulti && p.colorPrices.isNotEmpty;
    return AdminCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            p.isMulti
                ? 'Multicolor: la pieza lleva siempre esta combinación.'
                : 'El cliente elige uno de estos colores.',
            style: TextStyle(fontSize: 12, color: c.textDim, height: 1.35),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final color in p.colors)
                WrapTag(
                  hasPrices && p.colorPrices[color] != null
                      ? '$color · ${formatPrice(p.colorPrices[color]!)}'
                      : hasGrams && p.colorPrices[color] != null
                          ? '$color · ${_grams(p.colorPrices[color]!)}'
                          : color,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VariantCard extends StatelessWidget {
  const _VariantCard({required this.variant, required this.multi});
  final AdminProductVariant variant;
  final bool multi;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final v = variant;
    return AdminCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  v.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                v.price == null ? 'Precio base' : formatPrice(v.price!),
                style: TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: v.price == null ? c.textDim : Brand.gold,
                ),
              ),
            ],
          ),
          if (v.weightGrams != null) ...[
            const SizedBox(height: 4),
            Text('Peso ${_grams(v.weightGrams!)}', style: TextStyle(fontSize: 12, color: c.textDim)),
          ],
          if (v.colorPrices.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final e in v.colorPrices.entries) WrapTag('${e.key} · ${formatPrice(e.value)}'),
              ],
            ),
          ],
          if (v.colorGrams.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final e in v.colorGrams.entries) WrapTag('${e.key} · ${_grams(e.value)}'),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
