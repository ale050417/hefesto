// Calculadora de mentira para los tests que abren "Calcular precio" (la
// calculadora embebida de las consultas): devuelve filamentos y tipos de
// ejemplo y un precio fijo, sin tocar la red.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/calculadora/calc_extras_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';

const estimatorFilamentId = '11111111-1111-4111-8111-111111111111';

/// Carretes con TIPO de filamento (dos PLA con el mismo precio, un PLA Silk) y
/// uno suelto, sin tipo: lo que devuelve el servidor cuando hay tipos cargados.
const typedPlaVerdeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const typedPlaAzulId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const typedSilkId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const looseNegroId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

List<Map<String, dynamic>> typedFilamentsJson() => [
      {'id': typedPlaVerdeId, 'material': 'PLA', 'color': 'Verde', 'brand': 'Bambu Lab', 'costPerKg': 26000, 'hex': '#2E7D32', 'typeId': 't-pla', 'typeName': 'PLA'},
      {'id': typedPlaAzulId, 'material': 'PLA', 'color': 'Azul', 'brand': 'Bambu Lab', 'costPerKg': 26000, 'hex': '#1565C0', 'typeId': 't-pla', 'typeName': 'PLA'},
      {'id': typedSilkId, 'material': 'PLA', 'color': 'Dorado', 'brand': 'Grilon3', 'costPerKg': 34000, 'hex': '#C9A84C', 'typeId': 't-silk', 'typeName': 'PLA Silk (Dorado)'},
      {'id': looseNegroId, 'material': 'PETG', 'color': 'Negro', 'brand': 'Printalot', 'costPerKg': 18000, 'hex': '#111111', 'typeId': null, 'typeName': null},
    ];

/// Lo que devuelve `GET /api/v1/admin/calculadora` (el operador no recibe
/// márgenes: `presets` vacío).
CalcOverview sampleEstimatorOverview({
  bool admin = false,
  bool noFilaments = false,
  bool noPresets = false,
  bool typed = false,
  String longName = 'Decoración',
}) =>
    CalcOverview.fromJson({
      'isAdmin': admin,
      'config': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000, 'marginErrorPct': 8},
      'filaments': noFilaments
          ? []
          : typed
              ? typedFilamentsJson()
              : [
              {'id': estimatorFilamentId, 'material': 'PLA', 'color': 'Rojo', 'brand': 'Grilon3', 'costPerKg': 25000, 'hex': '#CC2200'},
              {'id': '22222222-2222-4222-8222-222222222222', 'material': 'PETG', 'color': 'Negro', 'brand': 'Printalot', 'costPerKg': 31000, 'hex': '#111111'},
            ],
      'presetOptions': noPresets
          ? []
          : [
              {'id': 'p1', 'name': 'Llaveros'},
              {'id': 'p2', 'name': 'Macetas'},
              {'id': 'p3', 'name': longName},
            ],
      'presets': const [],
      'history': const [],
      'stats': {'count': 0, 'grams': 0, 'hours': 0},
    });

class FakeEstimatorApi extends CalculadoraApi {
  FakeEstimatorApi({this.price = 2814}) : super(ApiClient());

  /// Precio que "calcula el servidor" (sin redondear, como llega de verdad).
  double price;
  Object? failWith;
  final quotes = <QuoteRequest>[];

  @override
  Future<CalcQuote> quote(QuoteRequest r) async {
    if (failWith != null) throw failWith!;
    quotes.add(r);
    return CalcQuote(precioFinal: price);
  }
}

/// Las llamadas nuevas de la calculadora (guardar por tipo de filamento, crear
/// un tipo de producto "que se cobra como" otro), sin tocar la red.
class FakeCalcExtrasApi extends CalcExtrasApi {
  FakeCalcExtrasApi() : super(ApiClient());

  Object? failWith;
  Map<String, Object?>? savedByType;
  final presetsCreated = <({String name, String likePresetId})>[];

  @override
  Future<String> saveCalcByType({
    required String name,
    String customer = '',
    required String filamentId,
    required double grams,
    required double hours,
    required String presetId,
    String notes = '',
  }) async {
    if (failWith != null) throw failWith!;
    savedByType = {'name': name, 'customer': customer, 'filamentId': filamentId, 'grams': grams, 'hours': hours, 'presetId': presetId, 'notes': notes};
    return 'nuevo';
  }

  @override
  Future<CalcPreset> createPresetLike({required String name, required String likePresetId}) async {
    if (failWith != null) throw failWith!;
    presetsCreated.add((name: name, likePresetId: likePresetId));
    // Como el servidor con un operador: id y nombre, NUNCA el margen.
    return CalcPreset(id: 'p-nuevo', name: name);
  }
}

/// Overrides para una pantalla que abre la calculadora embebida.
List<Override> estimatorOverrides(
  FakeEstimatorApi api, {
  CalcOverview? overview,
  Object? loadError,
  CalcExtrasApi? extras,
}) =>
    [
      if (extras != null) calcExtrasApiProvider.overrideWithValue(extras),
      calculadoraApiProvider.overrideWithValue(api),
      calculadoraProvider.overrideWith((ref) async {
        if (loadError != null) throw loadError;
        return overview ?? sampleEstimatorOverview();
      }),
    ];
