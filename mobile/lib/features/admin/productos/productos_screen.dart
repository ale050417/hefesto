import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/config.dart';
import '../../../core/format.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../admin_module.dart';
import '../admin_widgets.dart';
import 'catalogo_ui.dart';
import 'category_picker.dart';
import 'producto_detail_screen.dart';
import 'producto_form_screen.dart';
import 'productos_actions.dart';
import 'productos_models.dart';
import 'productos_providers.dart';

/// Productos del catálogo: listado con búsqueda y filtros, acciones rápidas
/// (destacar, publicar/archivar, eliminar), ficha y alta. Se abre desde "Más".
class AdminProductosScreen extends ConsumerStatefulWidget {
  const AdminProductosScreen({super.key});

  @override
  ConsumerState<AdminProductosScreen> createState() => _AdminProductosScreenState();
}

const _kStep = 40;

const _sortLabels = <String, String>{
  'updated': 'Modificados hace poco',
  'newest': 'Más nuevos',
  'name': 'Nombre (A-Z)',
  'price_asc': 'Precio: menor a mayor',
  'price_desc': 'Precio: mayor a menor',
};

class _AdminProductosScreenState extends ConsumerState<AdminProductosScreen> {
  final _searchCtl = TextEditingController();
  Timer? _debounce;
  ProductsFilter _filter = const ProductsFilter();
  String? _categoryName;
  // Los contadores no dependen de los filtros: se recuerdan para que no
  // parpadeen a vacío mientras carga una búsqueda nueva.
  ProductCounts _counts = const ProductCounts();

  /// Se está pidiendo la tanda siguiente ("Ver más").
  bool _loadingMore = false;

  /// El filtro "Categoría" se está abriendo (evita abrir dos hojas al tocar
  /// dos veces mientras cargan las categorías).
  bool _pickingCategory = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtl.dispose();
    super.dispose();
  }

  void _setFilter(ProductsFilter Function(ProductsFilter f) change) {
    setState(() => _filter = change(_filter));
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    // Espera a que se deje de tipear para no pedir al servidor por cada letra.
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) _setFilter((f) => f.copyWith(q: v.trim()));
    });
    setState(() {}); // refresca el botón de limpiar
  }

  Future<void> _refresh() async {
    ref.invalidate(adminProductsProvider(_filter));
    try {
      await ref.read(adminProductsProvider(_filter).future);
    } catch (_) {
      // El error ya lo muestra la lista.
    }
  }

  /// "Ver más": pide una tanda más grande SIN dejar de mostrar la actual, y
  /// recién cuando llegó cambia a ella. Antes se cambiaba de entrada: la lista
  /// se vaciaba (esqueleto) y al volver quedaba arriba de todo, perdiendo el
  /// lugar. Si falla, la lista queda como estaba y se avisa.
  Future<void> _loadMore() async {
    if (_loadingMore) return;
    final base = _filter;
    final next = base.copyWith(limit: (base.limit + _kStep).clamp(_kStep, kProductsMaxLimit));
    if (next == base) return;
    setState(() => _loadingMore = true);
    // Mantiene viva la tanda nueva mientras carga y hasta que la pantalla la
    // empiece a mostrar (si no, se descartaba y se volvía a pedir).
    final keepAlive = ref.listenManual(adminProductsProvider(next), (_, _) {});
    try {
      await ref.read(adminProductsProvider(next).future);
      // Si mientras tanto se cambió un filtro, esta tanda ya no corresponde.
      if (mounted && _filter == base) setState(() => _filter = next);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) showSnack(context, 'No pudimos cargar más productos. Probá de nuevo.', error: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
      WidgetsBinding.instance.addPostFrameCallback((_) => keepAlive.close());
    }
  }

  Future<void> _pickCategory() async {
    if (_pickingCategory) return;
    setState(() => _pickingCategory = true);
    // Se suelta el buscador: si no, al cerrar la hoja el teclado se reabre.
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      // Si la carga anterior falló, se vuelve a pedir (si no, el error quedaba
      // guardado y el filtro no abría más).
      if (ref.read(adminProductOptionsProvider).hasError) {
        ref.invalidate(adminProductOptionsProvider);
      }
      final options = await ref.read(adminProductOptionsProvider.future);
      if (!mounted) return;
      final pick = await pickCategory(
        context,
        options: options.categories,
        selectedId: _filter.categoryId,
        noneLabel: 'Todas las categorías',
        title: 'Filtrar por categoría',
      );
      if (pick == null || !mounted) return;
      final name = pick.id == null
          ? null
          : options.categories.where((o) => o.id == pick.id).firstOrNull?.name;
      setState(() {
        _categoryName = name;
        _filter = _filter.copyWith(category: (id: pick.id));
      });
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) showSnack(context, 'No pudimos cargar las categorías. Probá de nuevo.', error: true);
    } finally {
      if (mounted) setState(() => _pickingCategory = false);
    }
  }

  Future<void> _create() async {
    final id = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const AdminProductFormScreen()),
    );
    if (id != null && mounted) {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => AdminProductDetailScreen(id: id)),
      );
    }
  }

  void _open(AdminProductRow row) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AdminProductDetailScreen(id: row.id, initialName: row.name),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canCreate = me?.can('productos', 'crear') ?? false;
    final products = ref.watch(adminProductsProvider(_filter));
    final page = products.value;
    if (page != null) _counts = page.counts;
    // Categorías precargadas: así el filtro "Categoría" abre al instante (antes
    // cada toque esperaba al servidor sin mostrar nada).
    final options = ref.watch(adminProductOptionsProvider);

    final filtered = _filter.isFiltering;
    // El botón flotante se esconde mientras se escribe en el buscador (quedaba
    // encima de los resultados, que con el teclado abierto son un renglón) y
    // cuando la lista no cargó (quedaba pegado al botón "Reintentar").
    // (Solo cuenta el teclado de ESTA pantalla: si lo abrió una pantalla o una
    // hoja que está encima, el botón no se toca.)
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0 &&
        (ModalRoute.of(context)?.isCurrent ?? true);
    final showFab = canCreate && !keyboardOpen && !products.hasError;

    return AdminModuleScaffold(
      title: 'Productos',
      permission: 'productos',
      what: 'los productos',
      actions: [
        PopupMenuButton<String>(
          tooltip: 'Ordenar',
          icon: const Icon(Icons.sort_rounded),
          initialValue: _filter.sort,
          onSelected: (v) => _setFilter((f) => f.copyWith(sort: v)),
          itemBuilder: (_) => [
            for (final e in _sortLabels.entries)
              CheckedPopupMenuItem(
                value: e.key,
                checked: _filter.sort == e.key,
                child: Text(e.value),
              ),
          ],
        ),
      ],
      floatingActionButton: showFab
          // Sin colores a mano: el tema ya lo pinta dorado.
          ? FloatingActionButton.extended(
              // Sin animación "héroe" entre pantallas (no la usa y, al
              // esconderse y volver, podía chocar con la de otra ruta).
              heroTag: null,
              onPressed: _create,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nuevo'),
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
              // El servidor rechaza búsquedas de más de 80 letras.
              inputFormatters: [LengthLimitingTextInputFormatter(80)],
              decoration: InputDecoration(
                hintText: 'Buscar producto…',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchCtl.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Borrar la búsqueda',
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () {
                          _searchCtl.clear();
                          _debounce?.cancel();
                          _setFilter((f) => f.copyWith(q: ''));
                        },
                      ),
              ),
            ),
          ),
          // Filas de filtros de 44 dp de alto (eran 38: costaba acertarles con
          // el dedo). Los espacios se achicaron en la misma medida.
          const SizedBox(height: 6),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                for (final s in [
                  ('all', 'Todos', _counts.total),
                  ('published', 'Activos', _counts.published),
                  ('draft', 'Borradores', _counts.draft),
                  ('archived', 'Archivados', _counts.archived),
                ]) ...[
                  ChoiceChip(
                    label: Text(_counts.total == 0 && s.$1 != 'all' ? s.$2 : '${s.$2} (${s.$3})'),
                    selected: _filter.status == s.$1,
                    onSelected: (_) => _setFilter((f) => f.copyWith(status: s.$1)),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 2),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                // Filtro como los demás (sin color de fondo puesto a mano): con
                // una categoría elegida queda "encendido" con el color del tema.
                FilterChip(
                  avatar: _pickingCategory && options.isLoading
                      ? const SizedBox.square(
                          dimension: 14,
                          child: AppSpinner(),
                        )
                      : Icon(Icons.folder_open_rounded,
                          size: 16, color: _filter.categoryId == null ? c.textDim : Brand.gold),
                  label: Text(_categoryName ?? 'Categoría'),
                  showCheckmark: false,
                  selected: _filter.categoryId != null,
                  onSelected: (_) => _pickCategory(),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  avatar: Icon(Icons.star_rounded,
                      size: 16, color: _filter.featured ? Brand.gold : c.textDim),
                  label: const Text('Destacados'),
                  // Sin tilde: se dibujaba encima del ícono y lo ensuciaba (el
                  // filtro elegido ya se nota por el fondo y el ícono dorado).
                  showCheckmark: false,
                  selected: _filter.featured,
                  onSelected: (v) => _setFilter((f) => f.copyWith(featured: v)),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  avatar: Icon(Icons.local_offer_rounded,
                      size: 16, color: _filter.onSale ? Brand.gold : c.textDim),
                  label: const Text('En oferta'),
                  showCheckmark: false,
                  selected: _filter.onSale,
                  onSelected: (v) => _setFilter((f) => f.copyWith(onSale: v)),
                ),
                const SizedBox(width: 8),
                FilterChip(
                  avatar: Icon(Icons.no_photography_outlined,
                      size: 16, color: _filter.noImages ? Brand.gold : c.textDim),
                  label: const Text('Sin fotos'),
                  showCheckmark: false,
                  selected: _filter.noImages,
                  onSelected: (v) => _setFilter((f) => f.copyWith(noImages: v)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 2),
          Expanded(
            child: products.when(
              loading: () => const ListSkeleton(rows: 6, height: 104),
              error: (e, _) => ErrorView(
                message: errorText(e),
                onRetry: () => ref.invalidate(adminProductsProvider(_filter)),
              ),
              data: (page) => RefreshIndicator(
                color: Brand.gold,
                onRefresh: _refresh,
                child: page.items.isEmpty
                    ? ListView(
                        // Siempre desplazable: así se puede tirar para
                        // actualizar aunque el aviso entre en la pantalla.
                        physics: const AlwaysScrollableScrollPhysics(),
                        // Lugar para el botón flotante: con letra grande en un
                        // teléfono chico tapaba el final del texto.
                        padding: const EdgeInsets.only(top: 16, bottom: 96),
                        children: [
                          EmptyView(
                            icon: Icons.inventory_2_outlined,
                            title: filtered ? 'No hay productos para mostrar' : 'Todavía no hay productos',
                            subtitle: filtered
                                ? 'Probá quitando algún filtro o cambiando la búsqueda.'
                                : (canCreate
                                    ? 'Tocá "Nuevo" para crear el primero.'
                                    : 'Cuando se carguen productos, aparecen acá.'),
                          ),
                        ],
                      )
                    : _ProductList(
                        page: page,
                        filter: _filter,
                        loadingMore: _loadingMore,
                        onOpen: _open,
                        onMore: _loadMore,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductList extends StatelessWidget {
  const _ProductList({
    required this.page,
    required this.filter,
    required this.loadingMore,
    required this.onOpen,
    required this.onMore,
  });
  final AdminProductsPage page;
  final ProductsFilter filter;

  /// La tanda siguiente está en camino: el botón "Ver más" gira en vez de
  /// dejarse tocar otra vez.
  final bool loadingMore;
  final void Function(AdminProductRow row) onOpen;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    final shown = page.items.length;
    final more = page.total > shown;
    final canLoadMore = more && filter.limit < kProductsMaxLimit;
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      // Abajo queda lugar para el botón flotante.
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
      itemCount: shown + 2,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        if (i == 0) {
          return Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 0, 0),
            child: Text(
              more
                  ? 'Mostrando $shown de ${page.total} productos'
                  : '${page.total} ${page.total == 1 ? 'producto' : 'productos'}',
              style: TextStyle(fontSize: 12, color: c.textFaint),
            ),
          );
        }
        if (i == shown + 1) {
          if (canLoadMore) {
            return Center(
              child: OutlinedButton.icon(
                onPressed: loadingMore ? null : onMore,
                icon: loadingMore
                    ? const SizedBox.square(
                        dimension: 16,
                        child: AppSpinner(),
                      )
                    : const Icon(Icons.expand_more_rounded),
                label: Text(loadingMore ? 'Cargando…' : 'Ver más (${page.total - shown} restantes)'),
              ),
            );
          }
          return more
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'Hay ${page.total - shown} más: usá la búsqueda o los filtros para encontrarlos.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: c.textFaint),
                  ),
                )
              : const SizedBox.shrink();
        }
        final row = page.items[i - 1];
        return ProductTile(row: row, onTap: () => onOpen(row));
      },
    );
  }
}

/// Una fila del listado: foto, nombre, categoría, precio, chips de estado y
/// menú de acciones rápidas (según los permisos de la cuenta).
class ProductTile extends ConsumerWidget {
  const ProductTile({super.key, required this.row, required this.onTap});
  final AdminProductRow row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    final me = ref.watch(meProvider).value;
    final canEdit = me?.can('productos', 'editar') ?? false;
    final canDelete = me?.can('productos', 'eliminar') ?? false;
    final subtitle = [
      if (row.categoryName != null) row.categoryName!,
      if (row.material != null) row.material!,
    ].join(' · ');

    final items = <PopupMenuEntry<String>>[
      // Compartir: solo lo publicado (un oculto no abre en la tienda).
      if (row.status == ProductState.published)
        const PopupMenuItem(value: 'share', child: _MenuRow(Icons.share_rounded, 'Compartir por WhatsApp')),
      if (canEdit)
        PopupMenuItem(
          value: 'featured',
          child: _MenuRow(
            row.isFeatured ? Icons.star_outline_rounded : Icons.star_rounded,
            row.isFeatured ? 'Quitar de destacados' : 'Destacar',
          ),
        ),
      if (canEdit && row.status != ProductState.published)
        const PopupMenuItem(value: 'publish', child: _MenuRow(Icons.visibility_rounded, 'Publicar')),
      if (canDelete && row.status != ProductState.archived)
        const PopupMenuItem(value: 'archive', child: _MenuRow(Icons.inventory_2_outlined, 'Archivar')),
      if (canDelete)
        const PopupMenuItem(
          value: 'delete',
          child: _MenuRow(Icons.delete_outline_rounded, 'Eliminar', danger: true),
        ),
    ];

    return AdminCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox.square(
            dimension: 68,
            child: NetImage(row.imageUrl, position: row.imagePosition, radius: 14),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, height: 1.25),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12, color: c.textDim),
                  ),
                ],
                const SizedBox(height: 6),
                PriceLabel(price: row.price, salePrice: row.salePrice, from: row.variantCount > 0),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    InfoPill(
                      label: row.status.label,
                      icon: row.status.icon,
                      color: row.status.color(context),
                    ),
                    if (row.isFeatured)
                      const InfoPill(label: 'Destacado', icon: Icons.star_rounded, color: Brand.gold),
                    if (row.isOnSale && row.discountPercent != null)
                      InfoPill(label: '-${row.discountPercent}%', color: Brand.danger),
                    if (row.isNew) const InfoPill(label: 'Nuevo', color: Brand.info),
                    if (!row.hasPhotos)
                      const InfoPill(
                        label: 'Sin fotos',
                        icon: Icons.no_photography_outlined,
                        color: Brand.warning,
                      ),
                    if (row.variantCount > 0)
                      MiniTag('${row.variantCount} ${row.variantCount == 1 ? 'tamaño' : 'tamaños'}'),
                  ],
                ),
              ],
            ),
          ),
          if (items.isNotEmpty)
            PopupMenuButton<String>(
              tooltip: 'Acciones',
              padding: EdgeInsets.zero,
              icon: Icon(Icons.more_vert_rounded, color: c.textDim),
              itemBuilder: (_) => items,
              onSelected: (v) {
                switch (v) {
                  case 'share':
                    shareProductOnWhatsapp(
                      context,
                      name: row.name,
                      link: '${AppConfig.siteUrl}/producto/${row.slug}',
                      price: formatPrice(row.effectivePrice),
                    );
                  case 'featured':
                    toggleFeatured(context, id: row.id, value: !row.isFeatured);
                  case 'publish':
                    changeProductStatus(
                      context,
                      id: row.id,
                      name: row.name,
                      target: ProductState.published,
                      hasPhotos: row.hasPhotos,
                    );
                  case 'archive':
                    changeProductStatus(
                      context,
                      id: row.id,
                      name: row.name,
                      target: ProductState.archived,
                      hasPhotos: row.hasPhotos,
                    );
                  case 'delete':
                    deleteProduct(context, id: row.id, name: row.name);
                }
              },
            )
          else
            const SizedBox(width: 8),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow(this.icon, this.label, {this.danger = false});
  final IconData icon;
  final String label;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? Brand.danger : null;
    return Row(
      children: [
        Icon(icon, size: 20, color: color ?? context.hc.textDim),
        const SizedBox(width: 12),
        Flexible(child: Text(label, style: TextStyle(color: color))),
      ],
    );
  }
}
