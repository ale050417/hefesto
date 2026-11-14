import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'calculadora_models.dart';

/// Datos de una pieza para cotizar (solo ids y números: el costo/kg y el margen
/// los resuelve el servidor desde el filamento y el tipo elegidos).
class QuoteRequest {
  const QuoteRequest({
    required this.presetId,
    required this.filamentId,
    required this.grams,
    required this.hours,
  });

  final String presetId;
  final String filamentId;
  final double grams;
  final double hours;

  Map<String, dynamic> toJson() => {
        'presetId': presetId,
        'filamentId': filamentId,
        'grams': grams,
        'hours': hours,
      };
}

/// Llamadas de la Calculadora a `/api/v1/admin/calculadora*` (permiso
/// `calculadora`). Los errores salen como [ApiException] con el mensaje del servidor.
class CalculadoraApi {
  CalculadoraApi(this._api);
  final ApiClient _api;

  Future<CalcOverview> overview() async =>
      CalcOverview.fromJson(await _api.getJson('/admin/calculadora'));

  /// Costo y precio de una pieza, calculados en el servidor con `computeQuote`.
  Future<CalcQuote> quote(QuoteRequest r) async =>
      CalcQuote.fromJson(await _api.sendJson('POST', '/admin/calculadora/cotizar', body: r.toJson()));

  /// Guarda el cálculo en el historial. Devuelve el id.
  Future<String> saveCalc({
    required String name,
    String customer = '',
    required String filamentId,
    required double grams,
    required double hours,
    required String presetId,
    String notes = '',
  }) async {
    final res = await _api.sendJson('POST', '/admin/calculadora/historial', body: {
      'name': name,
      'customer': customer,
      'filamentId': filamentId,
      'grams': grams,
      'hours': hours,
      'presetId': presetId,
      'notes': notes,
    });
    return '${res['id'] ?? ''}';
  }

  Future<void> deleteCalc(String id) =>
      _api.sendJson('DELETE', '/admin/calculadora/historial/$id');

  Future<CalcConfig> saveConfig(CalcConfig config) async {
    final res = await _api.sendJson('PUT', '/admin/calculadora/config', body: config.toJson());
    return res['config'] is Map ? CalcConfig.fromJson(Map<String, dynamic>.from(res['config'] as Map)) : config;
  }

  // --- Tipos de producto con margen (solo admin) ---

  Future<void> createPreset({required String name, required double marginPct, bool active = true, int sortOrder = 0}) =>
      _api.sendJson('POST', '/admin/calculadora/tipos', body: {
        'name': name,
        'marginPct': marginPct,
        'active': active,
        'sortOrder': sortOrder,
      });

  Future<void> updatePreset(
    String id, {
    required String name,
    required double marginPct,
    required bool active,
    required int sortOrder,
  }) =>
      _api.sendJson('PATCH', '/admin/calculadora/tipos/$id', body: {
        'name': name,
        'marginPct': marginPct,
        'active': active,
        'sortOrder': sortOrder,
      });

  Future<void> deletePreset(String id) => _api.sendJson('DELETE', '/admin/calculadora/tipos/$id');
}

final calculadoraApiProvider = Provider<CalculadoraApi>((ref) => CalculadoraApi(ref.watch(apiClientProvider)));

// Sin reintentos automáticos: si falla se ve el error con "Reintentar".
Duration? _noRetry(int count, Object error) => null;

final calculadoraProvider = FutureProvider.autoDispose<CalcOverview>(
  (ref) => ref.watch(calculadoraApiProvider).overview(),
  retry: _noRetry,
);
