// Calculadora de mentira para los tests que abren "Calcular precio" (la
// calculadora embebida de las consultas): devuelve filamentos y tipos de
// ejemplo y un precio fijo, sin tocar la red.

import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:hefesto/core/api/api_client.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_api.dart';
import 'package:hefesto/features/admin/calculadora/calculadora_models.dart';

const estimatorFilamentId = '11111111-1111-4111-8111-111111111111';

/// Lo que devuelve `GET /api/v1/admin/calculadora` (el operador no recibe
/// márgenes: `presets` vacío).
CalcOverview sampleEstimatorOverview({
  bool admin = false,
  bool noFilaments = false,
  bool noPresets = false,
  String longName = 'Decoración',
}) =>
    CalcOverview.fromJson({
      'isAdmin': admin,
      'config': {'kwhPrice': 95, 'machineWatts': 220, 'machineLifeHours': 8000, 'maintenanceCost': 320000, 'marginErrorPct': 8},
      'filaments': noFilaments
          ? []
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

/// Overrides para una pantalla que abre la calculadora embebida.
List<Override> estimatorOverrides(FakeEstimatorApi api, {CalcOverview? overview, Object? loadError}) => [
      calculadoraApiProvider.overrideWithValue(api),
      calculadoraProvider.overrideWith((ref) async {
        if (loadError != null) throw loadError;
        return overview ?? sampleEstimatorOverview();
      }),
    ];
