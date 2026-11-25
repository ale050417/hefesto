import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/providers.dart';
import 'calculadora_models.dart';

/// Llamadas nuevas de la Calculadora (pedidos de Agustín, 2026-11-24/25):
/// guardar un cálculo hecho con un TIPO de filamento y crear un tipo de
/// producto "que se cobra como" otro.
///
/// Van aparte de [CalculadoraApi] para no cambiarle la forma: varias pruebas la
/// reemplazan entera con `implements`, y un método nuevo ahí las rompe.
class CalcExtrasApi {
  CalcExtrasApi(this._api);
  final ApiClient _api;

  /// Igual que `CalculadoraApi.saveCalc`, pero avisando que se eligió un TIPO
  /// (PLA, PETG…) y no un carrete: el historial guarda el nombre del tipo y
  /// ningún color. [filamentId] es el carrete que representa al tipo.
  Future<String> saveCalcByType({
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
      'byType': true,
    });
    return '${res['id'] ?? ''}';
  }

  /// Crea un tipo de producto que se cobra igual que [likePresetId] (permiso
  /// `calculadora/crear`: lo puede hacer el operador). El margen lo copia el
  /// servidor y NO viaja: solo vuelve si quien lo crea es admin.
  Future<CalcPreset> createPresetLike({required String name, required String likePresetId}) async {
    final res = await _api.sendJson('POST', '/admin/calculadora/tipos', body: {
      'name': name,
      'likePresetId': likePresetId,
    });
    return CalcPreset.fromJson({...res, 'name': res['name'] ?? name});
  }
}

final calcExtrasApiProvider = Provider<CalcExtrasApi>((ref) => CalcExtrasApi(ref.watch(apiClientProvider)));
