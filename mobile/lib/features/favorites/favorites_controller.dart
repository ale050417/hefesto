import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models.dart';
import '../../core/providers.dart';

/// Favoritos guardados en el dispositivo (la web los guarda en la cuenta; la
/// sincronización con la cuenta va en una fase posterior). Se guarda el
/// producto completo para poder mostrarlo sin red.
class FavoritesController extends Notifier<List<Product>> {
  static const _key = 'favorites_v1';

  @override
  List<Product> build() {
    final raw = ref.read(sharedPrefsProvider).getString(_key);
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List)
          .map((e) => Product.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  bool isFavorite(String id) => state.any((p) => p.id == id);

  Future<void> toggle(Product product) async {
    state = isFavorite(product.id)
        ? state.where((p) => p.id != product.id).toList()
        : [product, ...state];
    await ref
        .read(sharedPrefsProvider)
        .setString(_key, jsonEncode(state.map((p) => p.toJson()).toList()));
  }
}

final favoritesProvider =
    NotifierProvider<FavoritesController, List<Product>>(FavoritesController.new);
