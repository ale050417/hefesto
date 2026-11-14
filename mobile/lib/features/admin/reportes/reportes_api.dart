import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'reportes_models.dart';

/// Llamadas de Reportes a `/api/v1/admin/reportes*` (permiso `reportes`).
/// Los errores salen como [ApiException] con el mensaje del servidor.
class ReportesApi {
  ReportesApi(this._api);
  final ApiClient _api;

  /// Reportes del año (`null` = el año en curso).
  Future<ReportsOverview> overview({int? year}) async => ReportsOverview.fromJson(
        await _api.getJson('/admin/reportes', query: {'year': ?year}),
      );

  /// Ingresos por día de los últimos [days] días (7, 30 o 90).
  Future<DailySeries> daily(int days) async =>
      DailySeries.fromJson(await _api.getJson('/admin/reportes/diario', query: {'days': days}));

  /// CSV de ventas de la tienda de los últimos [days] días.
  Future<CsvExport> salesCsv({int days = 365}) async =>
      CsvExport.fromJson(await _api.getJson('/admin/reportes/csv', query: {'days': days}));
}

final reportesApiProvider = Provider<ReportesApi>((ref) => ReportesApi(ref.watch(apiClientProvider)));

// Sin reintentos automáticos: si falla se ve el error con "Reintentar".
Duration? _noRetry(int count, Object error) => null;

final reportesOverviewProvider = FutureProvider.autoDispose.family<ReportsOverview, int?>(
  (ref, year) => ref.watch(reportesApiProvider).overview(year: year),
  retry: _noRetry,
);

final reportesDailyProvider = FutureProvider.autoDispose.family<DailySeries, int>(
  (ref, days) => ref.watch(reportesApiProvider).daily(days),
  retry: _noRetry,
);
