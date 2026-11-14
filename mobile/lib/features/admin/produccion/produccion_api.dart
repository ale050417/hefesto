import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import '../admin_providers.dart';
import '../sale_status.dart';
import 'produccion_models.dart';

/// Llamadas a `/api/v1/admin/produccion/*`.
class ProduccionApi {
  ProduccionApi(this._api);
  final ApiClient _api;

  Future<BoardData> board() async => BoardData.fromJson(await _api.getJson('/admin/produccion'));

  /// Pasa una tarjeta a otra etapa del taller (lo mismo que arrastrarla en la
  /// web). Lanza `ApiException` con el motivo en castellano si el servidor la
  /// rechaza (transición inválida, falta el código de seguimiento…).
  Future<void> move(BoardCard card, SaleStatus to) async {
    await _api.sendJson(
      'POST',
      '/admin/produccion/${card.source}/${card.id}/status',
      body: {'status': to.api},
    );
  }

  /// Carga el código de seguimiento de un pedido online (necesario para
  /// marcarlo como enviado). Mismo endpoint que usa el detalle de la venta.
  Future<void> setTracking(String orderId, String code) =>
      _api.adminOrderMeta(orderId, trackingCode: code);
}

final produccionApiProvider = Provider<ProduccionApi>((ref) => ProduccionApi(ref.watch(apiClientProvider)));

Duration? _noRetry(int count, Object error) => null;

final produccionProvider = FutureProvider.autoDispose<BoardData>(
  (ref) => ref.watch(produccionApiProvider).board(),
  retry: _noRetry,
);

/// Mover una tarjeta cambia el estado de una venta: queda viejo el tablero, el
/// listado de ventas, el detalle y los contadores del inicio.
///
/// Recibe el CONTENEDOR (tomado antes del `await`) y no el `ref` de la hoja: si
/// el usuario la cerró mientras el servidor respondía, ese `ref` ya no se puede
/// usar y la cola quedaba mostrando la etapa vieja.
void invalidateBoard(ProviderContainer container) {
  container.invalidate(produccionProvider);
  // Lo mismo que `invalidateSales`: inicio, listado y detalle de ventas.
  container.invalidate(adminDashboardProvider);
  container.invalidate(adminSalesProvider);
  container.invalidate(adminSaleProvider);
  container.invalidate(adminStockProvider); // confirmar el pago descuenta filamento
}
