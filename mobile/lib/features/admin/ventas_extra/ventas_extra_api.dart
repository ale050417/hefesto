import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'ventas_extra_models.dart';

/// Llamadas de la carga / edición / baja de ventas (`/api/v1/admin/...`).
/// Todas lanzan [ApiException] con el mensaje en castellano del servidor.
class VentasExtraApi {
  VentasExtraApi(this._api);
  final ApiClient _api;

  /// Productos del catálogo con tamaños, colores y precio de cada combinación.
  Future<SaleCatalogPage> catalog({String q = '', int limit = 30}) async =>
      SaleCatalogPage.fromJson(await _api.getJson(
        '/admin/manual-sales/catalog',
        query: {if (q.trim().isNotEmpty) 'q': q.trim(), 'limit': limit},
      ));

  /// Categorías y clientes anteriores (ayudas del formulario).
  Future<SaleFormData> formData() async => SaleFormData.fromJson(
        await _api.getJson('/admin/manual-sales/form-data'),
      );

  Future<CreatedSale> createManualSale(Map<String, dynamic> body) async =>
      CreatedSale.fromJson(
        await _api.sendJson('POST', '/admin/manual-sales', body: body),
      );

  /// La venta tal como se puede editar (con costo y ganancia si el rol los ve).
  Future<ManualSaleEditData> manualSale(String id) async =>
      ManualSaleEditData.fromJson(await _api.getJson('/admin/manual-sales/$id'));

  Future<void> editManualSale(String id, Map<String, dynamic> body) async {
    await _api.sendJson('PATCH', '/admin/manual-sales/$id', body: body);
  }

  /// Solo admin (el servidor lo verifica). Repone el filamento descontado.
  Future<void> deleteManualSale(String id) async {
    await _api.sendJson('DELETE', '/admin/manual-sales/$id');
  }

  /// Solo admin. Repone filamento y revierte puntos y cupón.
  Future<void> deleteOrder(String id) async {
    await _api.sendJson('DELETE', '/admin/orders/$id');
  }
}

final ventasExtraApiProvider = Provider<VentasExtraApi>(
  (ref) => VentasExtraApi(ref.watch(apiClientProvider)),
);

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// Categorías y clientes anteriores. Son ayudas: si falla, el formulario sigue.
final saleFormDataProvider = FutureProvider.autoDispose<SaleFormData>(
  (ref) => ref.watch(ventasExtraApiProvider).formData(),
  retry: _noRetry,
);

/// Búsqueda en el catálogo ('' = los primeros por orden alfabético).
final saleCatalogProvider =
    FutureProvider.autoDispose.family<SaleCatalogPage, String>(
  (ref, q) => ref.watch(ventasExtraApiProvider).catalog(q: q),
  retry: _noRetry,
);

/// Una venta manual para editarla.
final manualSaleEditProvider =
    FutureProvider.autoDispose.family<ManualSaleEditData, String>(
  (ref, id) => ref.watch(ventasExtraApiProvider).manualSale(id),
  retry: _noRetry,
);
