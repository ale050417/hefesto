import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/modals.dart';
import '../../core/widgets/product_card.dart';

const _sorts = <String, String>{
  'newest': 'Novedades',
  'price_asc': 'Precio: menor a mayor',
  'price_desc': 'Precio: mayor a menor',
  'name': 'Nombre (A-Z)',
};

class CatalogScreen extends ConsumerStatefulWidget {
  const CatalogScreen({super.key, this.category, this.onSale = false, this.sort, this.focusSearch = false});
  final String? category;
  final bool onSale;
  final String? sort;
  final bool focusSearch;

  @override
  ConsumerState<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends ConsumerState<CatalogScreen> {
  final _scroll = ScrollController();
  final _search = TextEditingController();
  final _searchFocus = FocusNode();

  final List<Product> _items = [];
  List<CategoryItem> _categories = [];
  List<String> _materials = [];

  String? _category;
  String? _material;
  bool _onSale = false;
  String _sort = 'newest';
  RangeValues? _price;

  /// Tope del filtro de precio: el producto más caro del catálogo, redondeado
  /// para arriba (lo informa el servidor). Antes era fijo en $100.000 y había
  /// productos más caros que quedaban fuera de cualquier rango (2026-11-14).
  double _priceCeil = 100000;

  int _page = 1;
  int _totalPages = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  ApiException? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _category = widget.category;
    _onSale = widget.onSale;
    _sort = widget.sort ?? 'newest';
    _scroll.addListener(_onScroll);
    _load(reset: true);
    if (widget.focusSearch) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _searchFocus.requestFocus());
    }
  }

  @override
  void didUpdateWidget(CatalogScreen old) {
    super.didUpdateWidget(old);
    // Se llegó de nuevo desde el home con otro filtro (ej: otra categoría).
    if (old.category != widget.category ||
        old.onSale != widget.onSale ||
        old.sort != widget.sort) {
      _category = widget.category;
      _onSale = widget.onSale;
      _sort = widget.sort ?? 'newest';
      _load(reset: true);
    }
    if (widget.focusSearch && !old.focusSearch) _searchFocus.requestFocus();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _search.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 600 &&
        !_loadingMore &&
        !_loading &&
        _page < _totalPages) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    final ticket = ++_request;
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final next = reset ? 1 : _page + 1;
      final res = await ref.read(apiClientProvider).products(
            q: _search.text,
            category: _category,
            material: _material,
            minPrice: _price?.start,
            maxPrice: _price?.end,
            onSale: _onSale,
            sort: _sort,
            page: next,
            pageSize: 12,
            facets: reset && _categories.isEmpty,
          );
      if (!mounted || ticket != _request) return;
      setState(() {
        if (reset) _items.clear();
        _items.addAll(res.items);
        _page = res.page;
        _totalPages = res.totalPages;
        _total = res.total;
        if (res.categories.isNotEmpty) {
          _categories = res.categories.where((c) => c.parentId == null).toList();
          _materials = res.materials;
        }
        final top = res.priceMax;
        if (top != null && top > 0) {
          _priceCeil = ((top / 10000).ceil() * 10000).toDouble().clamp(10000, double.infinity);
        }
        _loading = false;
        _loadingMore = false;
      });
    } on ApiException catch (e) {
      if (!mounted || ticket != _request) return;
      setState(() {
        _error = e;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  int get _activeFilters =>
      (_material != null ? 1 : 0) + (_price != null ? 1 : 0) + (_onSale ? 1 : 0);

  Future<void> _openFilters() async {
    final result = await showAppSheet<_FilterResult>(
      context,
      builder: (_) => _FilterSheet(
        materials: _materials,
        material: _material,
        price: _price,
        onSale: _onSale,
        max: _priceCeil,
      ),
    );
    if (result == null) return;
    _material = result.material;
    _price = result.price;
    _onSale = result.onSale;
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _search,
                      focusNode: _searchFocus,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _load(reset: true),
                      decoration: InputDecoration(
                        hintText: 'Buscar productos, materiales…',
                        prefixIcon: Icon(Icons.search_rounded, color: c.textDim),
                        suffixIcon: _search.text.isEmpty
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close_rounded, size: 20),
                                onPressed: () {
                                  _search.clear();
                                  _load(reset: true);
                                  setState(() {});
                                },
                              ),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Badge(
                    isLabelVisible: _activeFilters > 0,
                    label: Text('$_activeFilters'),
                    backgroundColor: Brand.gold,
                    textColor: Brand.goldFg,
                    child: Material(
                      color: c.surface2,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: _openFilters,
                        child: Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: c.border),
                          ),
                          child: Icon(Icons.tune_rounded, color: c.text),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: [
                  _chip('Todas', _category == null, () {
                    _category = null;
                    _load(reset: true);
                  }),
                  for (final cat in _categories)
                    _chip(cat.name, _category == cat.slug, () {
                      _category = cat.slug;
                      _load(reset: true);
                    }),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 12, 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _loading ? 'Cargando…' : '$_total producto${_total == 1 ? '' : 's'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  PopupMenuButton<String>(
                    initialValue: _sort,
                    onSelected: (v) {
                      _sort = v;
                      _load(reset: true);
                    },
                    color: c.surface2,
                    itemBuilder: (_) => [
                      for (final e in _sorts.entries)
                        PopupMenuItem(value: e.key, child: Text(e.value)),
                    ],
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.swap_vert_rounded, size: 18, color: c.textDim),
                          const SizedBox(width: 4),
                          Text(_sorts[_sort]!,
                              style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: c.text)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(child: _body()),
          ],
        ),
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text(label),
          selected: selected,
          onSelected: (_) => onTap(),
          showCheckmark: false,
          labelStyle: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 12.5,
            color: selected ? Brand.gold : context.hc.text,
          ),
          side: BorderSide(color: selected ? Brand.gold : context.hc.border),
        ),
      );

  Widget _body() {
    if (_loading) return const LoadingView();
    if (_error != null) {
      return ErrorView(message: _error!.message, onRetry: () => _load(reset: true));
    }
    if (_items.isEmpty) {
      return const EmptyView(
        icon: Icons.search_off_rounded,
        title: 'No encontramos productos',
        subtitle: 'Probá con otra búsqueda o sacá algún filtro.',
      );
    }
    return RefreshIndicator(
      color: Brand.gold,
      onRefresh: () => _load(reset: true),
      child: GridView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        gridDelegate: productGridDelegate(context),
        itemCount: _items.length + (_loadingMore ? 2 : 0),
        itemBuilder: (_, i) {
          if (i >= _items.length) {
            return const Center(child: CircularProgressIndicator(color: Brand.gold));
          }
          return ProductCard(product: _items[i], section: 'catalogo');
        },
      ),
    );
  }
}

class _FilterResult {
  _FilterResult(this.material, this.price, this.onSale);
  final String? material;
  final RangeValues? price;
  final bool onSale;
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({
    required this.materials,
    required this.material,
    required this.price,
    required this.onSale,
    required this.max,
  });
  final List<String> materials;
  final String? material;
  final RangeValues? price;
  final bool onSale;

  /// Tope del rango de precio (el producto más caro, redondeado).
  final double max;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final double _max = widget.max;
  late String? _material = widget.material;
  // Un rango guardado con un tope anterior se acomoda al tope de hoy.
  late RangeValues _price = widget.price == null
      ? RangeValues(0, _max)
      : RangeValues(
          widget.price!.start.clamp(0, _max).toDouble(),
          widget.price!.end.clamp(0, _max).toDouble(),
        );
  late bool _onSale = widget.onSale;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return SheetBody(
      footer: GoldButton(
        key: const Key('apply_filters'),
        label: 'Aplicar filtros',
        onPressed: () {
          final untouched = _price.start == 0 && _price.end == _max;
          Navigator.pop(
            context,
            _FilterResult(_material, untouched ? null : _price, _onSale),
          );
        },
      ),
      children: [
        Row(
          children: [
            Expanded(child: Text('Filtros', style: Theme.of(context).textTheme.titleLarge)),
            TextButton(
              onPressed: () => Navigator.pop(context, _FilterResult(null, null, false)),
              child: const Text('Limpiar'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text('Precio', style: Theme.of(context).textTheme.titleSmall),
        RangeSlider(
          values: _price,
          min: 0,
          max: _max,
          // Pasos de $1.000.
          divisions: (_max / 1000).round().clamp(1, 1000),
          labels: RangeLabels(formatPrice(_price.start), formatPrice(_price.end)),
          onChanged: (v) => setState(() => _price = v),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(formatPrice(_price.start), style: TextStyle(color: c.textDim)),
            Text(formatPrice(_price.end),
                style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w700)),
          ],
        ),
        if (widget.materials.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('Material', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final m in widget.materials)
                ChoiceChip(
                  label: Text(m),
                  selected: _material == m,
                  showCheckmark: false,
                  onSelected: (s) => setState(() => _material = s ? m : null),
                  side: BorderSide(color: _material == m ? Brand.gold : c.border),
                ),
            ],
          ),
        ],
        const SizedBox(height: 12),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Solo ofertas'),
          value: _onSale,
          onChanged: (v) => setState(() => _onSale = v),
        ),
      ],
    );
  }
}
