import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'ganancias_models.dart';

/// Un socio tal como se manda al guardar (`id` null = socio nuevo).
class ShareDraft {
  const ShareDraft({this.id, required this.name, this.role = '', required this.pct});
  final String? id;
  final String name;
  final String role;
  final double pct;

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'name': name,
        'role': role,
        'pct': pct,
      };
}

/// Llamadas de Ganancias a `/api/v1/admin/ganancias*` (permiso `ganancias`).
/// Las reglas (el reparto suma 100%, etc.) las vuelve a validar el servidor.
class GananciasApi {
  GananciasApi(this._api);
  final ApiClient _api;

  /// `month`: `YYYY-MM`, `all` o null (el mes más nuevo con ventas).
  Future<EarningsOverview> overview({String? month}) async => EarningsOverview.fromJson(
        await _api.getJson('/admin/ganancias', query: {'mes': ?month}),
      );

  /// Guarda el reparto COMPLETO en una transacción. [removedIds] son los socios
  /// que se quitaron. Devuelve el reparto guardado (con ids de los nuevos).
  Future<List<ProfitShare>> saveShares(List<ShareDraft> shares, {List<String> removedIds = const []}) async {
    final res = await _api.sendJson('PUT', '/admin/ganancias/socios', body: {
      'shares': [for (final s in shares) s.toJson()],
      'removedIds': removedIds,
    });
    final list = res['shares'];
    return list is List
        ? [for (final e in list) if (e is Map) ProfitShare.fromJson(Map<String, dynamic>.from(e))]
        : const [];
  }

  Future<CostSettings> saveCosts(CostSettings settings) async {
    final res = await _api.sendJson('PUT', '/admin/ganancias/costos', body: settings.toJson());
    return res['settings'] is Map
        ? CostSettings.fromJson(Map<String, dynamic>.from(res['settings'] as Map))
        : settings;
  }
}

final gananciasApiProvider = Provider<GananciasApi>((ref) => GananciasApi(ref.watch(apiClientProvider)));

// Sin reintentos automáticos: si falla se ve el error con "Reintentar".
Duration? _noRetry(int count, Object error) => null;

/// `month` null = el mes más nuevo con ventas (lo decide el servidor).
final gananciasProvider = FutureProvider.autoDispose.family<EarningsOverview, String?>(
  (ref, month) => ref.watch(gananciasApiProvider).overview(month: month),
  retry: _noRetry,
);
