import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../admin_providers.dart';
import 'filamentos_models.dart';
import 'parse_util.dart';

/// Llamadas a `/api/v1/admin/filaments/*`. Todas lanzan `ApiException` con el
/// mensaje en castellano que manda el servidor.
class FilamentosApi {
  FilamentosApi(this._api);
  final ApiClient _api;

  Future<Filamento> get(String id) async {
    final json = await _api.getJson('/admin/filaments/$id');
    return Filamento.fromJson(Map<String, dynamic>.from(json['filament'] as Map));
  }

  /// Historial del ledger: de un carrete, o de todos si [filamentId] es null.
  Future<List<FilamentMovement>> movements({String? filamentId, int limit = 50}) async {
    final json = await _api.getJson('/admin/filaments/movements', query: {
      'filamentId': ?filamentId,
      'limit': limit,
    });
    return [for (final m in mapsOf(json['items'])) FilamentMovement.fromJson(m)];
  }

  Future<FilamentCatalog> catalog() async =>
      FilamentCatalog.fromJson(await _api.getJson('/admin/filaments/catalog'));

  Future<Filamento> create(FilamentoDraft d) async {
    final json = await _api.sendJson('POST', '/admin/filaments', body: d.toCreateJson());
    return Filamento.fromJson(Map<String, dynamic>.from(json['filament'] as Map));
  }

  Future<Filamento> update(String id, FilamentoDraft d) async {
    final json = await _api.sendJson('PATCH', '/admin/filaments/$id', body: d.toUpdateJson());
    return Filamento.fromJson(Map<String, dynamic>.from(json['filament'] as Map));
  }

  Future<void> delete(String id) async {
    await _api.sendJson('DELETE', '/admin/filaments/$id');
  }

  /// Ajuste manual: [deltaGrams] (con signo) o [newStockGrams] (stock contado).
  Future<StockAdjustResult> adjust(
    String id, {
    double? deltaGrams,
    double? newStockGrams,
    String? reason,
  }) async {
    final json = await _api.sendJson('POST', '/admin/filaments/$id/adjust', body: {
      'deltaGrams': ?deltaGrams,
      'newStockGrams': ?newStockGrams,
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
    return StockAdjustResult.fromJson(json);
  }

  /// [kind]: `color` · `brand` · `material`.
  Future<void> addCatalog(String kind, String name, {String? hex}) async {
    await _api.sendJson('POST', '/admin/filaments/catalog', body: {
      'kind': kind,
      'name': name,
      'hex': ?hex,
    });
  }

  Future<void> removeCatalog(String kind, String name) async {
    await _api.sendJson('DELETE', '/admin/filaments/catalog', query: {'kind': kind, 'name': name});
  }

  /// Informe de stock en texto (para copiar o mandar por WhatsApp).
  Future<String> report() async {
    final json = await _api.getJson('/admin/filaments/report');
    return strOf(json['text']);
  }
}

final filamentosApiProvider = Provider<FilamentosApi>(
  (ref) => FilamentosApi(ref.watch(apiClientProvider)),
);

Duration? _noRetry(int count, Object error) => null;

/// Un carrete (con costo) para el detalle y el formulario de edición.
final filamentoProvider = FutureProvider.autoDispose.family<Filamento, String>(
  (ref, id) => ref.watch(filamentosApiProvider).get(id),
  retry: _noRetry,
);

/// Historial del ledger: de un carrete (`id`) o de todos (`null`).
final filamentMovementsProvider =
    FutureProvider.autoDispose.family<List<FilamentMovement>, String?>(
  (ref, id) => ref.watch(filamentosApiProvider).movements(
        filamentId: id,
        limit: id == null ? 100 : 40,
      ),
  retry: _noRetry,
);

final filamentCatalogProvider = FutureProvider.autoDispose<FilamentCatalog>(
  (ref) => ref.watch(filamentosApiProvider).catalog(),
  retry: _noRetry,
);

/// Tras cualquier cambio de stock o de datos: el listado (módulo Filamentos), el
/// inicio (que muestra los carretes con stock bajo), el detalle y el historial
/// quedan viejos y se vuelven a pedir.
///
/// Recibe el CONTENEDOR (`ProviderScope.containerOf(context, listen: false)`,
/// tomado antes del `await`) y no el `ref` de la pantalla: si el usuario cerró
/// la hoja o volvió atrás mientras el servidor respondía, ese `ref` ya no se
/// puede usar (lanza) y las listas quedaban sin refrescar aunque el cambio se
/// había guardado.
void invalidateFilamentos(ProviderContainer container) {
  container.invalidate(adminStockProvider);
  container.invalidate(adminDashboardProvider);
  container.invalidate(filamentoProvider);
  container.invalidate(filamentMovementsProvider);
}
