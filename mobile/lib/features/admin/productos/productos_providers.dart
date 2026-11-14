import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'productos_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar" (en vez de quedar cargando con backoff).
Duration? _noRetry(int count, Object error) => null;

/// Llamadas a `/api/v1/admin/productos`. Cada una lanza [ApiException] con el
/// mensaje en castellano del servidor.
class ProductosRepo {
  ProductosRepo(this._api);
  final ApiClient _api;

  Future<AdminProductsPage> list(ProductsFilter f) async {
    final json = await _api.getJson('/admin/productos', query: {
      if (f.q.trim().isNotEmpty) 'q': f.q.trim(),
      if (f.status != 'all') 'status': f.status,
      'category': ?f.categoryId,
      if (f.featured) 'featured': 'true',
      if (f.onSale) 'onSale': 'true',
      if (f.noImages) 'noImages': 'true',
      'sort': f.sort,
      'page': 1,
      'pageSize': f.limit,
    });
    return AdminProductsPage.fromJson(json);
  }

  Future<AdminProductDetail> detail(String id) async {
    final json = await _api.getJson('/admin/productos/$id');
    return AdminProductDetail.fromJson(Map<String, dynamic>.from(json['product'] as Map));
  }

  Future<ProductOptions> options() async =>
      ProductOptions.fromJson(await _api.getJson('/admin/productos/opciones'));

  /// Alta básica: nace como borrador. Devuelve el id del producto nuevo.
  Future<String> create(Map<String, dynamic> body) async {
    final json = await _api.sendJson('POST', '/admin/productos', body: body);
    return '${json['id']}';
  }

  /// Edición parcial: solo se mandan los campos que cambiaron.
  Future<void> patch(String id, Map<String, dynamic> body) async {
    await _api.sendJson('PATCH', '/admin/productos/$id', body: body);
  }

  Future<void> setFeatured(String id, bool value) => patch(id, {'isFeatured': value});

  /// Publicar (`published`) o archivar (`archived`).
  Future<void> setStatus(String id, ProductState status) async {
    await _api.sendJson('POST', '/admin/productos/$id/estado', body: {'status': status.api});
  }

  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/productos/$id');
  }

  Future<void> setPrimaryImage(String id, String imageId) async {
    await _api.sendJson('POST', '/admin/productos/$id/imagen-principal',
        body: {'imageId': imageId});
  }
}

final productosRepoProvider =
    Provider<ProductosRepo>((ref) => ProductosRepo(ref.watch(apiClientProvider)));

final adminProductsProvider =
    FutureProvider.autoDispose.family<AdminProductsPage, ProductsFilter>(
  (ref, f) => ref.watch(productosRepoProvider).list(f),
  retry: _noRetry,
);

final adminProductProvider =
    FutureProvider.autoDispose.family<AdminProductDetail, String>(
  (ref, id) => ref.watch(productosRepoProvider).detail(id),
  retry: _noRetry,
);

/// Categorías (en orden de árbol) y materiales para los formularios.
final adminProductOptionsProvider = FutureProvider.autoDispose<ProductOptions>(
  (ref) => ref.watch(productosRepoProvider).options(),
  retry: _noRetry,
);

/// Tras crear, editar, publicar o borrar, todo lo que muestra productos queda
/// viejo (listado, ficha y la vidriera de la tienda): se vuelve a pedir.
void invalidateProducts(WidgetRef ref) {
  ref.invalidate(adminProductsProvider);
  ref.invalidate(adminProductProvider);
  ref.invalidate(homeProvider);
}
