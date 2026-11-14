import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/product_card.dart';
import 'favorites_controller.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favs = ref.watch(favoritesProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text('Favoritos', style: Theme.of(context).textTheme.headlineSmall),
      ),
      body: favs.isEmpty
          ? EmptyView(
              icon: Icons.favorite_border_rounded,
              title: 'Todavía no tenés favoritos',
              subtitle: 'Tocá el corazón en cualquier producto para guardarlo acá.',
              action: GoldButton(
                label: 'Explorar catálogo',
                expand: false,
                onPressed: () => context.go('/catalogo'),
              ),
            )
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              gridDelegate: productGridDelegate(context),
              itemCount: favs.length,
              itemBuilder: (_, i) => ProductCard(product: favs[i], section: 'favoritos'),
            ),
      backgroundColor: context.hc.bg,
    );
  }
}

// Mantiene el import de Brand usado si se agregan acentos.
// ignore: unused_element
const _brand = Brand.gold;
