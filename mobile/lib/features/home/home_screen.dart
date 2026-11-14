import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/product_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider);
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: home.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(
            message: e is ApiException ? e.message : 'No pudimos cargar la tienda.',
            onRetry: () => ref.invalidate(homeProvider),
          ),
          data: (data) => RefreshIndicator(
            color: Brand.gold,
            onRefresh: () async {
              ref.invalidate(homeProvider);
              await ref.read(homeProvider.future);
            },
            child: _HomeBody(data: data),
          ),
        ),
      ),
    );
  }
}

class _HomeBody extends StatelessWidget {
  const _HomeBody({required this.data});
  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final cats = data.categories.where((c) => c.parentId == null).toList();
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(child: _TopBar(brand: data.brand)),
        if (data.banners.isNotEmpty)
          SliverToBoxAdapter(
            child: _BannerCarousel(
              banners: data.banners,
              intervalSec: data.brand.bannerIntervalSec,
            ),
          ),
        SliverToBoxAdapter(child: _Stats(data: data)),
        if (cats.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: SectionHeader(
              eyebrow: 'Explorá',
              title: 'Categorías destacadas',
              onSeeAll: () => context.go('/catalogo'),
            ),
          ),
          SliverToBoxAdapter(child: _CategoryRow(categories: cats)),
        ],
        if (data.featured.isNotEmpty) ..._productSection(
          context,
          section: 'destacados',
          eyebrow: 'Lo más pedido',
          title: 'Más vendidos',
          products: data.featured,
        ),
        if (data.latest.isNotEmpty) ..._productSection(
          context,
          section: 'nuevos',
          eyebrow: 'Recién salidos',
          title: 'Nuevos lanzamientos',
          products: data.latest,
          route: '/catalogo?sort=newest',
        ),
        if (data.onSale.isNotEmpty) ..._productSection(
          context,
          section: 'ofertas',
          eyebrow: 'Aprovechá',
          title: 'Ofertas',
          products: data.onSale,
          route: '/catalogo?onSale=true',
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  List<Widget> _productSection(
    BuildContext context, {
    required String section,
    required String eyebrow,
    required String title,
    required List<Product> products,
    String route = '/catalogo',
  }) {
    return [
      SliverToBoxAdapter(
        child: SectionHeader(
          eyebrow: eyebrow,
          title: title,
          onSeeAll: () => context.go(route),
        ),
      ),
      SliverToBoxAdapter(
        child: SizedBox(
          height: 168 + cardTextExtent(context),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: products.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (_, i) => ProductCard(product: products[i], section: section, width: 168),
          ),
        ),
      ),
    ];
  }
}

class _TopBar extends ConsumerWidget {
  const _TopBar({required this.brand});
  final BrandInfo brand;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.hc;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 12, 6),
      child: Row(
        children: [
          BrandLogo(url: brand.logoUrl, size: 50),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: TextStyle(
                      fontFamily: 'Orbitron',
                      fontWeight: FontWeight.w800,
                      fontSize: 17,
                      color: c.text,
                      letterSpacing: 1,
                    ),
                    children: const [
                      TextSpan(text: 'HEFESTO '),
                      TextSpan(text: '3D', style: TextStyle(color: Brand.gold)),
                    ],
                  ),
                ),
                Text(
                  (brand.slogan ?? 'Forjado en capas').toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'Orbitron',
                    fontSize: 8.5,
                    letterSpacing: 2.2,
                    color: c.textFaint,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Buscar',
            onPressed: () => context.go('/catalogo?focus=search'),
            icon: Icon(Icons.search_rounded, color: c.text),
          ),
        ],
      ),
    );
  }
}

class _BannerCarousel extends StatefulWidget {
  const _BannerCarousel({required this.banners, required this.intervalSec});
  final List<BannerItem> banners;
  final int intervalSec;

  @override
  State<_BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<_BannerCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.banners.length > 1) {
      _timer = Timer.periodic(Duration(seconds: widget.intervalSec.clamp(3, 30)), (_) {
        if (!mounted || !_controller.hasClients) return;
        final next = (_index + 1) % widget.banners.length;
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 450),
          curve: Curves.easeOutCubic,
        );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AspectRatio(
            aspectRatio: 16 / 11,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: PageView.builder(
                controller: _controller,
                itemCount: widget.banners.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) => _BannerSlide(banner: widget.banners[i]),
              ),
            ),
          ),
        ),
        if (widget.banners.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < widget.banners.length; i++)
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _index ? 22 : 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: i == _index ? Brand.gold : c.surface3,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _BannerSlide extends StatelessWidget {
  const _BannerSlide({required this.banner});
  final BannerItem banner;

  @override
  Widget build(BuildContext context) {
    final align = switch (banner.align) {
      'center' => CrossAxisAlignment.center,
      'right' => CrossAxisAlignment.end,
      _ => CrossAxisAlignment.start,
    };
    return Stack(
      fit: StackFit.expand,
      children: [
        NetImage(banner.imageUrl, position: banner.position),
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x00000000), Color(0xCC000000)],
              stops: [0.45, 1],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: align,
            children: [
              Text(
                banner.title,
                style: const TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w800,
                  fontSize: 24,
                  color: Colors.white,
                  height: 1.1,
                ),
              ),
              if (banner.subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  banner.subtitle!,
                  style: const TextStyle(color: Colors.white70, fontSize: 13.5),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.data});
  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    Widget stat(String value, String label) => Expanded(
          child: Column(
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontFamily: 'Orbitron',
                  fontWeight: FontWeight.w800,
                  fontSize: 21,
                  color: Brand.gold,
                ),
              ),
              const SizedBox(height: 2),
              Text(label, style: TextStyle(fontSize: 11, color: c.textDim)),
            ],
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: c.surface1,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            stat(data.pieces > 0 ? '${data.pieces}+' : '—', 'Piezas impresas'),
            Container(width: 1, height: 30, color: c.border),
            stat(data.customers > 0 ? '${data.customers}+' : '—', 'Clientes'),
            Container(width: 1, height: 30, color: c.border),
            stat('48h', 'Producción'),
          ],
        ),
      ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.categories});
  final List<CategoryItem> categories;

  @override
  Widget build(BuildContext context) {
    final c = context.hc;
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (_, i) {
          final cat = categories[i];
          return GestureDetector(
            onTap: () => context.go('/catalogo?category=${cat.slug}'),
            child: SizedBox(
              width: 76,
              child: Column(
                children: [
                  Container(
                    width: 68,
                    height: 68,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: c.surface1,
                      border: Border.all(color: Brand.gold.withValues(alpha: 0.4), width: 1.5),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: cat.imageUrl != null
                        ? NetImage(cat.imageUrl)
                        : const Icon(Icons.category_rounded, color: Brand.gold, size: 28),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    cat.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: c.text,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
