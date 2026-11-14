import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import 'admin_models.dart';

// Sin reintentos automáticos: si falla, la pantalla muestra el error al
// instante con su botón "Reintentar" (en vez de quedar cargando con backoff).
Duration? _noRetry(int count, Object error) => null;

final adminDashboardProvider = FutureProvider.autoDispose<AdminDashboard>(
  (ref) => ref.watch(apiClientProvider).adminDashboard(),
  retry: _noRetry,
);

final adminSalesProvider = FutureProvider.autoDispose.family<SalesPage, SalesFilter>(
  (ref, f) => ref.watch(apiClientProvider).adminSales(type: f.type, status: f.status, q: f.q),
  retry: _noRetry,
);

typedef SaleKey = ({String source, String id});

final adminSaleProvider = FutureProvider.autoDispose.family<SaleDetail, SaleKey>(
  (ref, k) => ref.watch(apiClientProvider).adminSale(k.source, k.id),
  retry: _noRetry,
);

final adminStockProvider = FutureProvider.autoDispose<StockPage>(
  (ref) => ref.watch(apiClientProvider).adminFilaments(),
  retry: _noRetry,
);

/// Tras cambiar un estado o una nota, todo lo que muestra ventas queda viejo:
/// se invalida para que se vuelva a pedir al servidor.
void invalidateSales(WidgetRef ref) {
  ref.invalidate(adminDashboardProvider);
  ref.invalidate(adminSalesProvider);
  ref.invalidate(adminSaleProvider);
}
