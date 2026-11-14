import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../productos/productos_providers.dart';
import 'categorias_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// Llamadas a `/api/v1/admin/categorias`. Cada una lanza [ApiException] con el
/// mensaje en castellano del servidor.
class CategoriasRepo {
  CategoriasRepo(this._api);
  final ApiClient _api;

  Future<AdminCategoriesData> list() async =>
      AdminCategoriesData.fromJson(await _api.getJson('/admin/categorias'));

  /// Alta de categoría o subcategoría (`parentId`). Devuelve el id nuevo.
  Future<String> create(Map<String, dynamic> body) async {
    final json = await _api.sendJson('POST', '/admin/categorias', body: body);
    return '${json['id']}';
  }

  /// Edición parcial: solo lo que se manda. `parentId: null` la pasa a principal.
  Future<void> update(String id, Map<String, dynamic> body) async {
    await _api.sendJson('PATCH', '/admin/categorias/$id', body: body);
  }

  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/categorias/$id');
  }
}

final categoriasRepoProvider =
    Provider<CategoriasRepo>((ref) => CategoriasRepo(ref.watch(apiClientProvider)));

final adminCategoriesProvider = FutureProvider.autoDispose<AdminCategoriesData>(
  (ref) => ref.watch(categoriasRepoProvider).list(),
  retry: _noRetry,
);

/// Tras crear, editar o borrar una categoría, quedan viejos: su listado, los
/// selectores de categoría de Productos, los nombres que muestra cada producto
/// y la vidriera de la tienda.
void invalidateCategories(WidgetRef ref) {
  ref.invalidate(adminCategoriesProvider);
  ref.invalidate(adminProductOptionsProvider);
  ref.invalidate(adminProductsProvider);
  ref.invalidate(adminProductProvider);
  ref.invalidate(homeProvider);
}
