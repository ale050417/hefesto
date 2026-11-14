import '../filamentos/parse_util.dart';

/// Una impresión fallida (fila de `/admin/fallas`).
class Falla {
  const Falla({
    required this.id,
    required this.pieceName,
    required this.material,
    required this.color,
    required this.gramsLost,
    required this.reason,
    required this.deducted,
    required this.cost,
    this.notes,
    this.hex,
    this.createdAt,
  });

  final String id;
  final String pieceName;
  final String material;
  final String color;
  final double gramsLost;
  final String reason;

  /// ¿Descontó stock al registrarse? (si es así, borrarla lo devuelve).
  final bool deducted;

  /// Costo estimado del filamento perdido.
  final double cost;
  final String? notes;
  final String? hex;
  final DateTime? createdAt;

  /// "PLA · Rojo" (o lo que haya: las fallas viejas pueden no tener material).
  String get filamentLabel => [material, color].where((e) => e.isNotEmpty).join(' · ');

  factory Falla.fromJson(Map<String, dynamic> j) => Falla(
        id: strOf(j['id']),
        pieceName: strOf(j['pieceName']),
        material: strOf(j['material']),
        color: strOf(j['color']),
        gramsLost: numOf(j['gramsLost']),
        reason: strOf(j['reason'], 'Otro'),
        deducted: boolOf(j['deducted']),
        cost: numOf(j['cost']),
        notes: strOrNull(j['notes']),
        hex: strOrNull(j['hex']),
        createdAt: dateOf(j['createdAt']),
      );
}

class FallasSummary {
  const FallasSummary({
    required this.count,
    required this.totalGrams,
    required this.totalCost,
    this.topReason,
    this.topReasonCount = 0,
  });

  final int count;
  final double totalGrams;
  final double totalCost;
  final String? topReason;
  final int topReasonCount;

  factory FallasSummary.fromJson(Map<String, dynamic> j) => FallasSummary(
        count: intOf(j['count']),
        totalGrams: numOf(j['totalGrams']),
        totalCost: numOf(j['totalCost']),
        topReason: strOrNull(j['topReason']),
        topReasonCount: intOf(j['topReasonCount']),
      );
}

/// Un carrete elegible al registrar una falla (con su stock actual).
class FallaCarrete {
  const FallaCarrete({
    required this.id,
    required this.material,
    required this.color,
    required this.brand,
    required this.stockGrams,
    this.hex,
  });

  final String id;
  final String material;
  final String color;
  final String brand;
  final double stockGrams;
  final String? hex;

  /// "PLA · Rojo · Grilon3" (la marca distingue tres rojos).
  String get tag => [material, color, if (brand.isNotEmpty) brand].join(' · ');

  factory FallaCarrete.fromJson(Map<String, dynamic> j) => FallaCarrete(
        id: strOf(j['id']),
        material: strOf(j['material']),
        color: strOf(j['color']),
        brand: strOf(j['brand']),
        stockGrams: numOf(j['stockGrams']),
        hex: strOrNull(j['hex']),
      );
}

/// Causas por defecto (las mismas de la web) si el servidor no las manda.
const defaultFailReasons = [
  'Corte de luz',
  'Boquilla tapada',
  'Despegue de la cama',
  'Filamento enredado',
  'Error del modelo',
  'Calibración',
  'Otro',
];

/// Todo lo que devuelve `GET /admin/fallas`.
class FallasData {
  const FallasData({
    required this.items,
    required this.summary,
    required this.filaments,
    required this.materials,
    required this.reasons,
  });

  final List<Falla> items;
  final FallasSummary summary;
  final List<FallaCarrete> filaments;
  final List<String> materials;
  final List<String> reasons;

  factory FallasData.fromJson(Map<String, dynamic> j) {
    final items = [for (final m in mapsOf(j['items'])) Falla.fromJson(m)];
    final summaryJson = j['summary'];
    final reasons = stringsOf(j['reasons']);
    return FallasData(
      items: items,
      summary: summaryJson is Map
          ? FallasSummary.fromJson(Map<String, dynamic>.from(summaryJson))
          : FallasSummary(
              count: items.length,
              totalGrams: items.fold(0.0, (a, f) => a + f.gramsLost),
              totalCost: items.fold(0.0, (a, f) => a + f.cost),
            ),
      filaments: [for (final m in mapsOf(j['filaments'])) FallaCarrete.fromJson(m)],
      materials: stringsOf(j['materials']),
      reasons: reasons.isEmpty ? defaultFailReasons : reasons,
    );
  }
}

/// Qué devolvió el servidor al registrar una falla.
class FallaResult {
  const FallaResult({required this.deducted, required this.lowStock});
  final bool deducted;
  final bool lowStock;

  factory FallaResult.fromJson(Map<String, dynamic> j) =>
      FallaResult(deducted: boolOf(j['deducted']), lowStock: boolOf(j['lowStock']));
}

/// Una línea del alta multicolor: qué carrete y cuántos gramos se perdieron.
class FallaLine {
  const FallaLine({required this.filamentId, required this.grams});
  final String filamentId;
  final double grams;

  Map<String, dynamic> toJson() => {'filamentId': filamentId, 'grams': grams};
}

/// Datos para registrar (con `lines`) o corregir (sin ellas) una falla.
class FallaDraft {
  const FallaDraft({
    required this.pieceName,
    required this.material,
    required this.color,
    required this.gramsLost,
    required this.reason,
    this.notes,
    this.lines = const [],
  });

  final String pieceName;
  final String material;
  final String color;
  final double gramsLost;
  final String reason;
  final String? notes;
  final List<FallaLine> lines;

  /// Alta: igual que la web, una falla SIEMPRE consume filamento (deducted) y
  /// cada carrete descuenta por su línea.
  Map<String, dynamic> toCreateJson() => {
        ..._base(),
        'deducted': true,
        'colorLines': [for (final l in lines) l.toJson()],
      };

  /// Corrección: solo el registro (no toca el stock), como en la web.
  Map<String, dynamic> toUpdateJson() => _base();

  Map<String, dynamic> _base() => {
        'pieceName': pieceName,
        'material': material,
        'color': color,
        'gramsLost': gramsLost,
        'reason': reason,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}
